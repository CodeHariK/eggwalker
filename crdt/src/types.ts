import { getContent, localDelete, localInsert, mergeInto } from "./crdt"
import { HISTORY_LOG_ELEMENTS } from "./logs"

export type Id = [agent: string, seq: number]

export type Item = {
    content: string, // 1 character

    id: Id,
    originLeft: Id | null,
    originRight: Id | null,

    deleted: boolean,
}

export type Version = Record<string, number>

export type Doc = {
    agent: string,
    content: Item[],
    version: Version,
}

function createDoc(agentName: string): Doc {
    return {
        agent: agentName,
        content: [],
        version: {}
    }
}

export function cloneDoc(doc: Doc): any {
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

export function cloneItem(item: Item): Item {
    return {
        content: item.content,
        id: [item.id[0], item.id[1]],
        originLeft: item.originLeft ? [item.originLeft[0], item.originLeft[1]] : null,
        originRight: item.originRight ? [item.originRight[0], item.originRight[1]] : null,
        deleted: item.deleted,
    }
}

export class CRDTDocument {
    doc: Doc

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

    merge(other: CRDTDocument): HTMLDivElement[] {
        mergeInto(this.doc, other.doc)
        return HISTORY_LOG_ELEMENTS
    }

    reset() {
        this.doc = createDoc(this.doc.agent)
    }
}

function idToString(id: Id | null): string | null {
    return id ? `${id[0]}:${id[1]}` : null;
}

export function itemReplacer(key: string, value: any): any {
    if (
        key === 'id' ||
        key === 'originLeft' ||
        key === 'originRight'
    ) {
        return idToString(value);
    }
    return value;
}
