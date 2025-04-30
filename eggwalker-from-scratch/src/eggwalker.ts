// GUIDs that compress
export type Id = [
    agent: string,
    seq: number
]

//Local version
type LV = number

type OpInner<T> = {
    type: 'ins',
    content: T,
    pos: number,
} | {
    type: 'del',
    pos: number,
}

type Op<T> = OpInner<T> & {
    id: Id, //Global unique id
    parents: LV[],
}

// Last known seq number for every agent
type RemoteVersion = Record<string, number>

type OpLog<T> = {
    ops: Op<T>[] // Every operation locally seen
    frontier: LV[]

    version: RemoteVersion
}

function createOpLog<T>(): OpLog<T> {
    return {
        ops: [],
        frontier: [],
        version: {}
    }
}

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

function localInsert<T>(oplog: OpLog<T>, agent: string, pos: number, content: T[]) {

    for (const c of content) {
        pushLocalOp(
            oplog,
            agent,
            { type: 'ins', content: c, pos })
        pos++
    }
}

function localDelete<T>(oplog: OpLog<T>, agent: string, pos: number, delLen: number) {
    while (delLen > 0) {
        pushLocalOp(
            oplog,
            agent,
            { type: 'del', pos })
        delLen--
    }
}

const idEq = (a: Id, b: Id): boolean => (
    a == b || (a[0] === b[0] && a[1] == b[1])
)

function idToLV(oplog: OpLog<any>, id: Id): LV {
    const idx = oplog.ops.findIndex(op => idEq(op.id, id))
    if (idx < 0) throw Error('Could not find id in oplog')
    return idx
}

const sortLVs = (frontier: LV[]): LV[] => frontier.sort((a, b) => a - b)

function advanceFrontier(frontier: LV[], lv: LV, parents: LV[]): LV[] {
    const f = frontier.filter(v => !parents.includes(v))
    f.push(lv)
    return sortLVs(f)
}

function pushRemoteOp<T>(oplog: OpLog<T>, op: Op<T>, parentIds: Id[]) {
    const [agent, seq] = op.id
    const lastKnownSeq = oplog.version[agent] ?? -1

    if (lastKnownSeq >= seq) return // We already have the op

    const lv = oplog.ops.length
    const parents = sortLVs(parentIds.map(id => idToLV(oplog, id)))

    oplog.ops.push({ ...op, parents })

    oplog.frontier = advanceFrontier(oplog.frontier, lv, parents)
    if (seq != lastKnownSeq + 1) throw Error('Seq numbers out of order')
    oplog.version[agent] = seq
}

function mergeInto<T>(dest: OpLog<T>, src: OpLog<T>) {
    for (const op of src.ops) {
        const parentIds = op.parents.map(lv => src.ops[lv].id)
        pushRemoteOp(dest, op, parentIds)
    }
}

type CRDTItem = {}

function checkout<T>(oplog: OpLog<T>) {
    let currentVersion = []

    for (let lv = 0; lv < oplog.ops.length; lv++) {
        const op = oplog.ops[lv]

        // retreat
        // advance
        // apply
        console.log('apply', lv)
    }
}

const oplog1 = createOpLog<string>()
const oplog2 = createOpLog<string>()

localInsert(oplog1, 'seph', 0, [...'a'])
localInsert(oplog2, 'alice', 0, [...'b'])

mergeInto(oplog1, oplog2)
mergeInto(oplog2, oplog1)

console.log(oplog2)
console.table(oplog2.ops)
