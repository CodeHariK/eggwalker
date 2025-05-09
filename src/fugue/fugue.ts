import { HistoryLog } from "../logs"
import { cloneItem, cloneDoc, Doc, Item, isInVersion, idEq, findItemAtPos, findItemIdxById } from "./types"

function localInsertOne(doc: Doc, pos: number, text: string) {
  const seq = (doc.version[doc.agent] ?? -1) + 1

  const idx = findItemAtPos(doc, pos, true)

  integrate(doc, {
    content: text,
    id: [doc.agent, seq],
    deleted: false,
    originLeft: doc.content[idx - 1]?.id ?? null,
    originRight: doc.content[idx]?.id ?? null,
  })
}

export function localInsert(doc: Doc, pos: number, text: string) {
  const content = [...text]
  for (const c of content) {
    localInsertOne(doc, pos, c)
    pos++
  }
}

function remoteInsert(doc: Doc, item: Item) {
  integrate(doc, item)
}

export function localDelete(doc: Doc, pos: number, delLen: number) {
  while (delLen > 0) {
    const idx = findItemAtPos(doc, pos, false)
    doc.content[idx].deleted = true
    delLen--

    HistoryLog(...[
      `localDelete ${idx}`,
      {
        type: "fuguedeldoc",
        "doc": cloneDoc(doc),
        "highlight": idx,
      }
    ])
  }
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

  let IntegrateLog: any[] = []

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
      IntegrateLog.push(`> scanning:${scanning} , destIdx:${destIdx}`)
    }

    if (i === doc.content.length) {
      IntegrateLog.push("> If we reach the end of the document, just insert (i == doc.content.length)")
      break
    }
    if (i === right) {
      IntegrateLog.push(`> i:${i} right:${right} No ambiguity / concurrency. Insert here (i == right)`)
      break
    }

    let other = doc.content[i]
    let oleft = findItemIdxById(doc, other.originLeft) ?? -1
    let oright = other.originRight == null
      ? doc.content.length
      : findItemIdxById(doc, other.originRight)!

    IntegrateLog.push(...[
      // {
      //   "index": i,
      //   "oleft": oleft,
      //   "oright": oright,
      //   "other": other
      // },
      {
        type: "fugueinsdoc",
        "doc": cloneDoc(doc),
        "originleft": left,
        "originright": right,
        "destIdx": destIdx,
        "newItem": newItem,
      },
    ])

    // The logic below summarizes to:
    // if (oleft < left || (oleft === left && oright === right && newItem.id[0] < other.id[0])) break
    // if (oleft === left) scanning = oright < right

    // This is the same code as the above 2 lines, but written out the long way:
    if (oleft < left) {
      IntegrateLog.push(`> Insert destIdx:${destIdx} oleft < left break`)
      break
    } else if (oleft === left) {
      // Middle row.
      if (oright < right) {
        scanning = true
        IntegrateLog.push(`> This is tricky. We're looking at an item we *might* insert after - but we can't tell yet!
          destIdx:${destIdx} oleft === left oright < right, scanning true, continue`)
        continue
      } else if (oright === right) {
        // Raw conflict. Order based on user agents.
        if (newItem.id[0] < other.id[0]) {
          IntegrateLog.push(`> destIdx:${destIdx} oleft == left oright == right, compare agents : ${newItem.id[0]} < ${other.id[0]} == true;  break`)
          break
        }
        else {
          scanning = false
          IntegrateLog.push(`> destIdx:${destIdx} oleft == left oright == right, compare agents : ${newItem.id[0]} < ${other.id[0]} == false; scanning:${scanning} continue`)
          continue
        }
      } else { // oright > right
        scanning = false
        IntegrateLog.push(`> Center right, destIdx:${destIdx} oleft == left oright > right, scanning:${scanning}, continue`)
        continue
      }
    } else { // oleft > left
      IntegrateLog.push(`> Skip, destIdx:${destIdx}, oleft > left; continue`)

      continue
    }
  }

  // We've found the position. Insert here.
  doc.content.splice(destIdx, 0, cloneItem(newItem))

  IntegrateLog.push({
    type: "fugueinsdoc",
    "doc": cloneDoc(doc),
    "highlight": destIdx,
  })

  HistoryLog(...IntegrateLog)
}

export function canInsertNow(item: Item, doc: Doc): boolean {
  // We need op.id to not be in doc.versions
  // originLeft and originRight to be in.
  // We're also inserting each item from each agent in sequence, either seq == 0 or seq-1 to be in
  const [agent, seq] = item.id
  return !isInVersion(item.id, doc.version)
    && (seq === 0 || isInVersion([agent, seq - 1], doc.version))
    && isInVersion(item.originLeft, doc.version)
    && isInVersion(item.originRight, doc.version)
}

export function mergeInto(dest: Doc, src: Doc) {
  const missing: (Item | null)[] = src.content.filter(item => !isInVersion(item.id, dest.version))
  let remaining = missing.length

  let IntegrateLog = []

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
      let deleted = destItem.deleted
      destItem.deleted = true
      if (!deleted) {
        IntegrateLog.push({
          type: "fuguedeldoc",
          "doc": cloneDoc(dest),
          "highlight": destIdx,
        })
      }
    }

    srcIdx++
    destIdx++
  }

  // IntegrateLog.push(...[
  //   { type: "doc", "doc": cloneDoc(dest) },
  //   { type: "doc", "doc": cloneDoc(src) }
  // ])

  if (IntegrateLog.length > 0) {
    HistoryLog(...IntegrateLog)
  }
}

// @1 : HYPER
// @2 : labs
// Merge LEFT RIGHT
// HYPERlabs

// @1 : HYPER OMEGA labs
// @2 : adv HYPER gen
// Merge LEFT RIGHT
// adv HYPER OMEGA gen
