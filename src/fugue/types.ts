import { localDelete, localInsert, mergeInto } from "./fugue"
import { HISTORY_LOG_ELEMENTS } from "../logs"
import { Id } from "../types"

export type FugueItem = {
    content: string, // 1 character

    id: Id,
    originLeft: Id | null,
    originRight: Id | null,

    deleted: boolean,
}

export type Version = Record<string, number>

export type FugueDoc = {
    agent: string,
    content: FugueItem[],
    version: Version,
}

function createDoc(agentName: string): FugueDoc {
    return {
        agent: agentName,
        content: [],
        version: {}
    }
}

export function cloneDoc(doc: FugueDoc): any {
    return {
        agent: doc.agent,
        string: getContent(doc),
        content: doc.content.map(item => ({
            content: item.content,
            id: [...item.id],
            originLeft: item.originLeft ? [...item.originLeft] : null,
            originRight: item.originRight ? [...item.originRight] : null,
            deleted: item.deleted,
        })),
        version: { ...doc.version },
    }
}

export function cloneItem(item: FugueItem): FugueItem {
    return {
        content: item.content,
        id: [item.id[0], item.id[1]],
        originLeft: item.originLeft ? [item.originLeft[0], item.originLeft[1]] : null,
        originRight: item.originRight ? [item.originRight[0], item.originRight[1]] : null,
        deleted: item.deleted,
    }
}

export class CRDTDocument {
    doc: FugueDoc

    constructor(agent: string) {
        this.doc = createDoc(agent)
    }

    ins(pos: number, text: string): HTMLDivElement[] {
        localInsert(this.doc, pos, text)
        return HISTORY_LOG_ELEMENTS
    }

    del(pos: number, delLen: number): HTMLDivElement[] {
        localDelete(this.doc, pos, delLen)
        return HISTORY_LOG_ELEMENTS
    }

    getString() {
        return getContent(this.doc)
    }

    mergeFrom(other: CRDTDocument): HTMLDivElement[] {
        mergeInto(this.doc, other.doc)
        return HISTORY_LOG_ELEMENTS
    }

    reset() {
        this.doc = createDoc(this.doc.agent)
    }
}

export function isInVersion(id: Id | null, version: Version): boolean {
    if (id == null) return true
    const [agent, seq] = id
    const highestSeq = version[agent]
    return highestSeq != null && highestSeq >= seq
}

export const idEq = (a: Id | null, b: Id | null): boolean => (
    a == b || (a != null && b != null && a[0] === b[0] && a[1] === b[1])
)

export function findItemIdxById(doc: FugueDoc, id: Id | null): number | null {
    if (id == null) return null

    // return doc.content.findIndex(c => idEq(c.id, id))
    for (let i = 0; i < doc.content.length; i++) {
        if (idEq(doc.content[i].id, id)) return i
    }
    throw Error("Can't find item")
}

export const findItemAtPos = (doc: FugueDoc, pos: number, stickEnd: boolean = false): number => {

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

export function getContent(doc: FugueDoc): string {
    let content = ''
    for (const item of doc.content) {
        if (!item.deleted) {
            content += item.content
        }
    }
    return content
}
