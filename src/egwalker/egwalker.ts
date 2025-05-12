import PriorityQueue from "priorityqueuejs"
import { HistoryLog } from "../logs"
import { Id } from "../types"
import { Branch, compareArrays, CRDTItem, EgwalkerDoc, findByCurrentPos, findItemIdxAtLV, idToLV, INSERTED, LV, NOT_YET_INSERTED, Op, OpInner, OpLog, OpsToVisit, sortLVs } from "./types"

function pushLocalOp<T>(oplog: OpLog<T>, agent: string, op: OpInner<T>) {
  const seq = (oplog.version[agent] ?? -1) + 1

  const lv = oplog.ops.length
  oplog.ops.push({
    ...op,
    id: [agent, seq],
    parents: oplog.frontier,
  })

  oplog.frontier = [lv]
  oplog.version[agent] = seq
}

export function localInsert<T>(oplog: OpLog<T>, agent: string, pos: number, content: T[]) {
  for (const c of content) {
    pushLocalOp(oplog, agent, {
      type: 'ins',
      content: c,
      pos
    })
    pos++
  }
}

export function localDelete<T>(oplog: OpLog<T>, agent: string, pos: number, delLen: number) {
  while (delLen > 0) {
    pushLocalOp(oplog, agent, {
      type: 'del',
      pos
    })
    delLen--
  }
}

function advanceFrontier(frontier: LV[], lv: LV, parents: LV[]): LV[] {
  const f = frontier.filter(v => !parents.includes(v))
  f.push(lv)
  return sortLVs(f)
}

function pushRemoteOp<T>(oplog: OpLog<T>, op: Op<T>, parentIds: Id[]) {
  const [agent, seq] = op.id
  const lastKnownSeq = oplog.version[agent] ?? -1
  if (lastKnownSeq >= seq) return // We already have the op.

  const lv = oplog.ops.length
  const parents = sortLVs(parentIds.map(id => idToLV(oplog, id)))

  oplog.ops.push({
    ...op,
    parents
  })

  oplog.frontier = advanceFrontier(oplog.frontier, lv, parents)
  if (seq !== lastKnownSeq + 1) throw Error('Seq numbers out of order')
  oplog.version[agent] = seq
}

export function mergeInto<T>(dest: OpLog<T>, src: OpLog<T>) {
  for (const op of src.ops) {
    const parentIds = op.parents.map(lv => src.ops[lv].id)
    pushRemoteOp(dest, op, parentIds)
  }
}


function diff(oplog: OpLog<any>, a: LV[], b: LV[]): { aOnly: LV[], bOnly: LV[] } {

  const enum DiffFlag { A, B, Shared }

  // Tracks whether an LV is only in A, only in B, or in both (shared)
  const flags = new Map<LV, DiffFlag>()

  let numShared = 0

  // A priority queue of LVs to process 
  const queue = new PriorityQueue<LV>()

  function enq(v: LV, flag: DiffFlag) {

    // Queue v, with the specified flag.
    const oldFlag = flags.get(v)

    if (oldFlag == null) {
      queue.enq(v)
      flags.set(v, flag)
      if (flag === DiffFlag.Shared) numShared++
    }
    else if (flag !== oldFlag && oldFlag !== DiffFlag.Shared) {
      flags.set(v, DiffFlag.Shared)
      numShared++
    }
  }

  for (const aa of a) enq(aa, DiffFlag.A)
  for (const bb of b) enq(bb, DiffFlag.B)

  const aOnly: LV[] = [], bOnly: LV[] = []

  while (queue.size() > numShared) {
    const lv = queue.deq()
    const flag = flags.get(lv)!

    if (flag === DiffFlag.Shared) numShared--
    else if (flag === DiffFlag.A) aOnly.push(lv)
    else if (flag === DiffFlag.B) bOnly.push(lv)

    const op = oplog.ops[lv]
    for (const p of op.parents) enq(p, flag)
  }

  HistoryLog([
    "Diff",
    { oplog },
    { "a": a },
    { "b": b },
    { "aOnly": aOnly },
    { "bOnly": bOnly }
  ])

  return { aOnly, bOnly }
}

function retreat(doc: EgwalkerDoc, oplog: OpLog<any>, opLv: LV) {
  const op = oplog.ops[opLv]

  const targetLV = op.type === 'ins'
    ? opLv
    : doc.delTargets[opLv]

  const item = doc.itemsByLV[targetLV]
  item.curState--
}

function advance(doc: EgwalkerDoc, oplog: OpLog<any>, opLv: LV) {
  const op = oplog.ops[opLv]

  const targetLV = op.type === 'ins'
    ? opLv
    : doc.delTargets[opLv]

  const item = doc.itemsByLV[targetLV]
  item.curState++
}

function integrate<T>(
  doc: EgwalkerDoc, oplog: OpLog<T>, newItem: CRDTItem,
  idx: number, endPos: number, snapshot: T[] | null
) {
  let scanIdx = idx
  let scanEndPos = endPos

  let IntegrateLog: any[] = []

  // If originLeft is -1, that means it was inserted at the start of the document.
  // We'll pretend there was some item at position -1 which we were inserted to the
  // right of.
  let left = scanIdx - 1
  let right = newItem.originRight == -1
    ? doc.items.length
    : findItemIdxAtLV(doc.items, newItem.originRight)!

  let scanning = false

  // This loop scans forward from destIdx until it finds the right place to insert into
  // the list.
  while (scanIdx < right) {
    IntegrateLog.push(`> scanning:${scanning}, idx:${idx}, endPos:${endPos}, scanIdx:${scanIdx}, scanEndPos:${scanEndPos}`)

    let other = doc.items[scanIdx]

    if (other.curState !== NOT_YET_INSERTED) {
      IntegrateLog.push("> other.curState !== NOT_YET_INSERTED; break;")
      break
    }

    let oleft = other.originLeft === -1
      ? -1
      : findItemIdxAtLV(doc.items, other.originLeft)

    let oright = other.originRight === -1
      ? doc.items.length
      : findItemIdxAtLV(doc.items, other.originRight)

    // The logic below summarizes to:
    const newItemAgent = oplog.ops[newItem.lv].id[0]
    const otherAgent = oplog.ops[other.lv].id[0]

    if (oleft < left
      || (oleft === left && oright === right && newItemAgent < otherAgent)) {
      IntegrateLog.push("> oleft < left or compare agent; break;")
      break
    }
    if (oleft === left) scanning = oright < right

    if (!other.deleted) scanEndPos++
    scanIdx++

    if (!scanning) {
      idx = scanIdx
      endPos = scanEndPos
    }
  }

  // We've found the position. Insert here.
  doc.items.splice(idx, 0, newItem)

  const op = oplog.ops[newItem.lv]
  if (op.type !== 'ins') throw Error('Cannot insert a delete')
  if (snapshot != null) snapshot.splice(endPos, 0, op.content)

  IntegrateLog.push(
    {
      type: "egwalkerinsdoc",
      "doc": doc,
      "highlight": idx,
      "snapshot": snapshot,
    },
    {
      oplog
    })
  HistoryLog(...IntegrateLog)

}


function apply<T>(doc: EgwalkerDoc, oplog: OpLog<T>, snapshot: T[] | null, opLv: LV) {
  const op = oplog.ops[opLv]

  if (op.type === 'del') {
    // Delete!

    // find the item that will be deleted.
    let { idx, endPos } = findByCurrentPos(doc.items, op.pos)

    // Scan forward to find the actual item!
    while (doc.items[idx].curState !== INSERTED) {
      if (!doc.items[idx].deleted) endPos++
      idx++
    }

    // This is it
    const item = doc.items[idx]

    if (!item.deleted) {
      item.deleted = true
      if (snapshot != null) snapshot.splice(endPos, 1)
    }

    item.curState = 1

    doc.delTargets[opLv] = item.lv

  } else {
    // Insert
    const { idx, endPos } = findByCurrentPos(doc.items, op.pos)

    if (idx >= 1 && doc.items[idx - 1].curState !== INSERTED) {
      throw Error('Item to the left is not inserted! What!')
    }

    const originLeft = idx === 0 ? -1 : doc.items[idx - 1].lv

    // let originRight = doc.items[idx].lv
    let originRight = -1
    for (let i = idx; i < doc.items.length; i++) {
      const item2 = doc.items[i]
      if (item2.curState !== NOT_YET_INSERTED) {
        // Use this item as our "right" item.
        originRight = item2.lv
        break
      }
    }

    const item: CRDTItem = {
      lv: opLv,
      originLeft,
      originRight,
      deleted: false,
      curState: INSERTED,
    }
    doc.itemsByLV[opLv] = item

    // insert it into the document list
    integrate(doc, oplog, item, idx, endPos, snapshot)
  }
}

export function checkout<T>(oplog: OpLog<T>): T[] {
  const doc: EgwalkerDoc = {
    items: [],
    currentVersion: [],
    delTargets: [],
    itemsByLV: []
  }

  const snapshot: T[] = []

  for (let lv = 0; lv < oplog.ops.length; lv++) {
    do1Operation(doc, oplog, lv, snapshot)
  }

  return snapshot
}

function do1Operation<T>(doc: EgwalkerDoc, oplog: OpLog<T>, lv: LV, snapshot: T[] | null) {
  const op = oplog.ops[lv]

  const { aOnly, bOnly } = diff(oplog, doc.currentVersion, op.parents)

  let IntegrateLog = []

  // retreat
  for (const i of aOnly) {
    retreat(doc, oplog, i)
  }

  IntegrateLog.push(...["Retreat",
    {
      type: "egwalkerinsdoc",
      "log": oplog,
      "doc": doc,
    },
    { oplog }
  ])

  // advance
  for (const i of bOnly) {
    advance(doc, oplog, i)
  }

  IntegrateLog.push(...["Advance",
    {
      type: "egwalkerinsdoc",
      "log": oplog,
      "doc": doc,
    }
  ])

  apply(doc, oplog, snapshot, lv)
  doc.currentVersion = [lv]

  IntegrateLog.push(...["Apply",
    {
      type: "egwalkerinsdoc",
      "log": oplog,
      "doc": doc,
      "snapshot": snapshot,
    }
  ])

  HistoryLog(...IntegrateLog)
}


export function findOpsToVisit(oplog: OpLog<any>, a: LV[], b: LV[]): OpsToVisit {
  // if (a.length === 0 && b.length === 0) return { start: [], common: [], bOnly: [] }

  type MergePoint = {
    v: LV[], // Sorted in inverse order (highest to lowest)
    isInA: boolean,
  }

  const queue = new PriorityQueue<MergePoint>((a, b) => {
    // What about when they have different isInA flags? It shouldn't matter.
    return compareArrays(a.v, b.v)
  })

  const enq = (lv: LV[], isInA: boolean) => {
    const mergePoint = {
      v: lv.slice().sort((a, b) => b - a), // Sort in descending order.
      isInA
    }
    queue.enq(mergePoint)
  }

  enq(a, true)
  enq(b, false)

  let commonVersion: LV[]
  const sharedOps = [], bOnlyOps = []

  // console.log('a', a, 'b', b)
  while (true) {
    let { v, isInA } = queue.deq()
    // console.log('deq', v, isInA)
    if (v.length === 0) {
      // We've hit the root element.
      commonVersion = []
      break
    }

    while (!queue.isEmpty()) {
      // We might have multiple elements that have the same merge point.
      // Gross.
      //
      // Consume everything that matches.
      const { v: peekV, isInA: peekIsInA } = queue.peek()
      if (compareArrays(v, peekV) !== 0) break // Stop if the merge point is different.

      queue.deq()
      if (peekIsInA) isInA = true
    }

    // Finally we hit a common version!
    if (queue.isEmpty()) {
      commonVersion = v.reverse()
      break
    }

    if (v.length >= 2) {
      // Its a merger! Just add all the individual items.
      for (const vv of v) enq([vv], isInA)
    } else {
      const lv = v[0]
      // Length must be 1, since we checked for a length of 0 above.
      if (isInA) sharedOps.push(lv)
      else bOnlyOps.push(lv)

      // Add parents.
      const op = oplog.ops[lv]
      enq(op.parents, isInA)
    }
  }

  return {
    commonVersion,
    sharedOps: sharedOps.reverse(),
    bOnlyOps: bOnlyOps.reverse()
  }
}

export function checkoutFancy<T>(
  oplog: OpLog<T>,
  branch: Branch<T>,
  mergeFrontier: LV[] = oplog.frontier
) {
  const {
    commonVersion,
    sharedOps,
    bOnlyOps
  } = findOpsToVisit(oplog, branch.frontier, mergeFrontier)

  HistoryLog(
    "checkout fancy findOpsToVisit",
    { oplog },
    { branch },
    { mergeFrontier },
    { commonVersion },
    { sharedOps },
    { bOnlyOps },
  )

  const doc: EgwalkerDoc = {
    items: [],
    currentVersion: commonVersion,
    delTargets: [],
    itemsByLV: []
  }

  const placeholderLength = Math.max(...branch.frontier) + 1
  for (let i = 0; i < placeholderLength; i++) {
    const item: CRDTItem = {
      lv: i + 1e12,
      curState: INSERTED,
      deleted: false,
      originLeft: -1,
      originRight: -1
    }
    doc.items.push(item)
    doc.itemsByLV[item.lv] = item
  }


  // 1. Go through all changes in snapshot version (frontier) (ignore snapshot)
  // 2. Add all other operations (modify the snapshot)
  for (const lv of sharedOps) {
    do1Operation(doc, oplog, lv, null)
  }

  for (const lv of bOnlyOps) {
    do1Operation(doc, oplog, lv, branch.snapshot)
    branch.frontier = advanceFrontier(branch.frontier, lv, oplog.ops[lv].parents)
  }

  HistoryLog('visited:', sharedOps.length + bOnlyOps.length, 'total:', oplog.ops.length)
}
