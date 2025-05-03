import { syntaxHighlight } from "./editor"

const HISTORY_LOG_ELEMENTS: HTMLDivElement[] = []

export function HistoryLog(...data: any[]) {
  const container = document.createElement("div")
  container.className = "history-entry"

  data.forEach((d) => {
    const block = document.createElement("div")

    if (typeof d === 'object' && d !== null) {
      block.className = "log-object"
      block.innerHTML = `<pre>${syntaxHighlight(d)}</pre>`
    } else {
      block.className = "log-text"
      block.textContent = String(d)
    }

    container.appendChild(block)
  })

  HISTORY_LOG_ELEMENTS.push(container)
}

type Id = [agent: string, seq: number]

type Item = {
  content: string, // 1 character

  id: Id,
  originLeft: Id | null,
  originRight: Id | null,

  deleted: boolean,
}

type Version = Record<string, number>

type Doc = {
  content: Item[],
  version: Version,
}

function createDoc(): Doc {
  return {
    content: [],
    version: {}
  }
}

export function getContent(doc: Doc): string {
  let content = ''
  for (const item of doc.content) {
    if (!item.deleted) {
      content += item.content
    }
  }
  return content
}

const findItemAtPos = (doc: Doc, pos: number, stickEnd: boolean = false): number => {

  // Find the index of the item at the specified content position in the document.
  // if stickend : return item index when pos become 0
  // if !stickend : return item index when pos become 0 and after all the deleted

  // pos : 2, stickend: true
  // a,-,-,b,-,c,-,-,-
  // _,_,_,*
  // index = 3

  // pos : 2, stickend: false
  // a,-,-,b,-,c,-,-,-
  // _,_,_,_,_,*
  // index = 5

  let i = 0
  for (; i < doc.content.length; i++) {
    const item = doc.content[i]
    if (stickEnd && pos === 0) return i
    else if (item.deleted) continue
    else if (pos === 0) return i

    pos--
  }

  if (pos === 0) return i
  else throw Error('past end of the document')
}

function localInsertOne(doc: Doc, agent: string, pos: number, text: string) {
  const seq = (doc.version[agent] ?? -1) + 1

  HistoryLog({
    "localInsertOne agent": agent,
    "pos ": pos,
    "text ": text,
    "seq ": seq
  })

  const idx = findItemAtPos(doc, pos, true)

  integrate(doc, {
    content: text,
    id: [agent, seq],
    deleted: false,
    originLeft: doc.content[idx - 1]?.id ?? null,
    originRight: doc.content[idx]?.id ?? null,
  })
}

function localInsert(doc: Doc, agent: string, pos: number, text: string) {
  const content = [...text]
  for (const c of content) {
    localInsertOne(doc, agent, pos, c)
    pos++
  }
}

function remoteInsert(doc: Doc, item: Item) {
  integrate(doc, item)
}

function localDelete(doc: Doc, pos: number, delLen: number) {
  while (delLen > 0) {
    const idx = findItemAtPos(doc, pos, false)
    doc.content[idx].deleted = true
    delLen--
    HistoryLog("-------- Deleted", idx)
  }
}

const idEq = (a: Id | null, b: Id | null): boolean => (
  a == b || (a != null && b != null && a[0] === b[0] && a[1] === b[1])
)

function findItemIdxById(doc: Doc, id: Id | null): number | null {
  if (id == null) return null

  // return doc.content.findIndex(c => idEq(c.id, id))
  for (let i = 0; i < doc.content.length; i++) {
    if (idEq(doc.content[i].id, id)) return i
  }
  throw Error("Can't find item")
}

function integrate(doc: Doc, newItem: Item) {
  const [agent, seq] = newItem.id
  const lastSeen = doc.version[agent] ?? -1
  if (seq !== lastSeen + 1) throw Error('Operations out of order')

  // Mark the item in the document version.
  doc.version[agent] = seq

  // If originLeft is null, that means it was inserted at the start of the document.
  // We'll pretend there was some item at position -1 which we were inserted to the
  // right of.
  let left = findItemIdxById(doc, newItem.originLeft) ?? -1
  let destIdx = left + 1
  let right = newItem.originRight == null
    ? doc.content.length :
    findItemIdxById(doc, newItem.originRight)!

  let IntegrateLog: any[] = [{
    "integrate": { left, right },
    "newItem": newItem,
    "doc": deepCloneDoc(doc)
  }]

  let scanning = false

  /*
                oright
              <    =    >
            +----+----+---+
    oleft < | I  | I  | I |
          = | ?  | id | S |
          > | S  | S  | S |
            +----+----+---+
    Legend:
    I  = Insert (break)
    ?  = Ambiguous (scan)
    id = Compare id
    S  = Skip (continue)

  •	Insert immediately if other has an earlier originLeft.
  •	Scan (ambiguous) when origins are equal but destination is earlier — could be an “insertion race”.
  •	Compare by ID when origins are identical — deterministic ordering.
  •	Skip when the other item comes from a later insertion.
  */

  // This loop scans forward from destIdx until it finds the right place to insert into the list.
  for (let i = destIdx; ; i++) {
    if (!scanning) {
      destIdx = i
      IntegrateLog.push(`scanning false ${destIdx}`)
    }

    if (i === doc.content.length) {
      IntegrateLog.push("--------- If we reach the end of the document, just insert")
      break
    }

    if (i === right) {
      IntegrateLog.push(`--------- No ambiguity / concurrency. Insert here ${i} ${right}`)
      break
    }

    let other = doc.content[i]
    let oleft = findItemIdxById(doc, other.originLeft) ?? -1
    let oright = other.originRight == null
      ? doc.content.length
      : findItemIdxById(doc, other.originRight)!

    IntegrateLog.push({
      "other": other,
      "index": i,
      "oleft": oleft,
      "oright": oright
    })

    // The logic below summarizes to:
    // if (oleft < left || (oleft === left && oright === right && newItem.id[0] < other.id[0])) break
    // if (oleft === left) scanning = oright < right

    // This is the same code as the above 2 lines, but written out the long way:
    if (oleft < left) {

      IntegrateLog.push(`--------- oleft < left break ${destIdx}`)

      // Top row. Insert, insert, arbitrary (insert)
      break
    } else if (oleft === left) {
      // Middle row.
      if (oright < right) {
        // This is tricky. We're looking at an item we *might* insert after - but we can't tell yet!
        scanning = true

        IntegrateLog.push(`--------- oleft === left oright < right scanning true continue ${destIdx}`)

        continue
      } else if (oright === right) {
        // Raw conflict. Order based on user agents.
        if (newItem.id[0] < other.id[0]) {

          IntegrateLog.push(`--------- oleft == left oright == right newItem.id[0] < other.id[0] break ${destIdx}`)

          break
        }
        else {
          scanning = false

          IntegrateLog.push(`--------- oleft == left oright == right scanning false continue ${destIdx}`)

          continue
        }
      } else { // oright > right
        scanning = false

        IntegrateLog.push(`--------- oleft == left oright == right scanning false continue ${destIdx}`)

        continue
      }
    } else { // oleft > left
      // Bottom row. Arbitrary (skip), skip, skip
      IntegrateLog.push(`--------- oleft > left continue ${destIdx}`)

      continue
    }
  }

  // We've found the position. Insert here.
  doc.content.splice(destIdx, 0, cloneItem(newItem))

  IntegrateLog.push({ "--------- destIdx": destIdx, "doc": deepCloneDoc(doc) })

  HistoryLog(IntegrateLog)
}

function isInVersion(id: Id | null, version: Version): boolean {
  if (id == null) return true
  const [agent, seq] = id
  const highestSeq = version[agent]
  return highestSeq != null && highestSeq >= seq
}

function canInsertNow(item: Item, doc: Doc): boolean {
  // We need op.id to not be in doc.versions
  // originLeft and originRight to be in.
  // We're also inserting each item from each agent in sequence, either seq == 0 or seq-1 to be in
  const [agent, seq] = item.id
  return !isInVersion(item.id, doc.version)
    && (seq === 0 || isInVersion([agent, seq - 1], doc.version))
    && isInVersion(item.originLeft, doc.version)
    && isInVersion(item.originRight, doc.version)
}

function mergeInto(dest: Doc, src: Doc) {
  const missing: (Item | null)[] = src.content.filter(item => !isInVersion(item.id, dest.version))
  let remaining = missing.length

  while (remaining > 0) {
    // Find the next item in remaining and insert it.
    let mergedOnThisPass = 0

    for (let i = 0; i < missing.length; i++) {
      const item = missing[i]
      if (item == null) continue
      if (!canInsertNow(item, dest)) continue

      // Insert it.
      remoteInsert(dest, item)
      missing[i] = null
      remaining--
      mergedOnThisPass++
    }

    if (mergedOnThisPass === 0) throw Error('Not making progress')
  }

  // Apply deletions
  let srcIdx = 0, destIdx = 0
  while (srcIdx < src.content.length) {
    const srcItem = src.content[srcIdx]
    let destItem = dest.content[destIdx]

    while (!idEq(srcItem.id, destItem.id)) {
      destIdx++
      destItem = dest.content[destIdx]
    }

    if (srcItem.deleted) {
      destItem.deleted = true
      HistoryLog({ "MergeInto Delete": destItem })
    }

    srcIdx++
    destIdx++
  }

}


export class CRDTDocument {
  doc: Doc
  agent: string

  constructor(agent: string) {
    this.doc = createDoc()
    this.agent = agent
  }

  ins(pos: number, text: string): HTMLDivElement[] {
    localInsert(this.doc, this.agent, pos, text)
    return HISTORY_LOG_ELEMENTS
  }

  del(pos: number, delLen: number): HTMLDivElement[] {
    localDelete(this.doc, pos, delLen)
    return HISTORY_LOG_ELEMENTS
  }

  getString() {
    return getContent(this.doc)
  }

  merge(other: CRDTDocument): HTMLDivElement[] {
    mergeInto(this.doc, other.doc)
    return HISTORY_LOG_ELEMENTS
  }

  reset() {
    this.doc = createDoc()
  }
}

export function deepCloneDoc(doc: Doc): any {
  return {
    string: getContent(doc),
    content: doc.content.map(item => ({
      content: item.content, // ✅ include this!
      id: [...item.id],
      originLeft: item.originLeft ? [...item.originLeft] : null,
      originRight: item.originRight ? [...item.originRight] : null,
      deleted: item.deleted,
    })),
    version: { ...doc.version },
  }
}

function cloneItem(item: Item): Item {
  return {
    content: item.content,
    id: [item.id[0], item.id[1]],
    originLeft: item.originLeft ? [item.originLeft[0], item.originLeft[1]] : null,
    originRight: item.originRight ? [item.originRight[0], item.originRight[1]] : null,
    deleted: item.deleted,
  }
}
