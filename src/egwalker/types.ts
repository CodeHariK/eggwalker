import { HISTORY_LOG_ELEMENTS } from "../logs"
import { Id } from "../types"
import { checkout, checkoutFancy, localDelete, localInsert, mergeInto } from "./egwalker"

export type LV = number

export type OpInner<T> = {
    type: 'ins',
    content: T,
    pos: number,
} | {
    type: 'del',
    pos: number,
}

export type Op<T> = OpInner<T> & {
    id: Id,
    parents: LV[],
}

type RemoteVersion = Record<string, number> // Last known seq number for every agent

export type OpLog<T> = {
    ops: Op<T>[]
    frontier: LV[],

    version: RemoteVersion,
}

function createOpLog<T>(): OpLog<T> {
    return {
        ops: [],
        frontier: [],
        version: {}
    }
}

export const NOT_YET_INSERTED = -1
export const INSERTED = 0
// DELETED(1) = 1, DELETED(2) = 2, ....

export type CRDTItem = {
    lv: LV,
    originLeft: LV | -1,
    originRight: LV | -1,

    deleted: boolean,

    curState: number, // State variable
}

export type CRDTDoc = {
    items: CRDTItem[],
    currentVersion: LV[],

    delTargets: LV[] // LV of a delete op
    itemsByLV: CRDTItem[] // Map from LV => CRDTItem.
    // itemsByLV: Map<LV, CRDTItem> // Map from LV => CRDTItem.
}

export type Branch<T> = {
    snapshot: T[],
    frontier: LV[],
}

export class CRDTDocument {
    oplog: OpLog<string>
    agent: string
    branch: Branch<string>

    constructor(agent: string) {
        this.oplog = createOpLog()
        this.agent = agent
        this.branch = createBranch()
    }

    check() {
        const actualDoc = checkout(this.oplog)
        if (actualDoc.join('') !== this.branch.snapshot.join('')) {
            throw Error('Document out of sync')
        }
    }

    ins(pos: number, text: string): HTMLDivElement[] {
        const inserted = [...text]
        localInsert(this.oplog, this.agent, pos, inserted)
        this.branch.snapshot.splice(pos, 0, ...inserted)
        this.branch.frontier = this.oplog.frontier.slice()
        return HISTORY_LOG_ELEMENTS
    }

    del(pos: number, delLen: number): HTMLDivElement[] {
        localDelete(this.oplog, this.agent, pos, delLen)
        // this.snapshot = checkout(this.oplog)
        this.branch.snapshot.splice(pos, delLen)
        this.branch.frontier = this.oplog.frontier.slice()
        return HISTORY_LOG_ELEMENTS
    }

    getString() {
        // return checkout(this.oplog).join('')
        return this.branch.snapshot.join('')
    }

    mergeFrom(other: CRDTDocument): HTMLDivElement[] {
        mergeInto(this.oplog, other.oplog)
        // this.snapshot = checkout(this.oplog)
        checkoutFancy(this.oplog, this.branch)

        return HISTORY_LOG_ELEMENTS
    }

    reset() {
        this.oplog = createOpLog()
        this.branch = createBranch()
    }
}

function createBranch<T>(): Branch<T> {
    return {
        snapshot: [],
        frontier: []
    }
}


export type OpsToVisit = {
    commonVersion: LV[],
    sharedOps: LV[],
    bOnlyOps: LV[],
}


const idEq = (a: Id, b: Id): boolean => (
    a == b || (a[0] === b[0] && a[1] === b[1])
)

export function idToLV(oplog: OpLog<any>, id: Id): LV {
    const idx = oplog.ops.findIndex(op => idEq(op.id, id))
    if (idx < 0) throw Error('Could not find id in oplog')
    return idx
}

export const sortLVs = (frontier: LV[]): LV[] => frontier.sort((a, b) => a - b)

export function findItemIdxAtLV(items: CRDTItem[], lv: LV) {
    const idx = items.findIndex(item => item.lv === lv)
    if (idx < 0) throw Error('Could not find item')
    return idx
}

export function findByCurrentPos(items: CRDTItem[], targetPos: number): { idx: number, endPos: number } {
    let curPos = 0
    let endPos = 0
    let idx = 0

    for (; curPos < targetPos; idx++) {
        if (idx >= items.length) throw Error('Past end of items list')

        const item = items[idx]
        if (item.curState === INSERTED) curPos++
        if (!item.deleted) endPos++
    }

    return { idx, endPos }
}
