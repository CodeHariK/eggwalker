import { createEgwalkerDocViewer, createFugueDocViewer } from "./render"
import { FugueDoc, getContent } from "./fugue/types"
import { Id } from "./types"
import { renderGraphAndGetInnerHTML, toDotSrc } from "./egwalker/dot"

export const HISTORY_LOG_ELEMENTS: HTMLDivElement[] = []

export function HistoryLog(...logs: any[]) {
    const container = document.createElement("div")
    container.className = "history-entry"

    const block = document.createElement("div")
    block.classList.add("doc-object")

    for (const log of logs) {

        if (typeof log === 'object' && log !== null && (log.type === "fugueinsdoc" || log.type === "fuguedeldoc")) {
            let doc = log.doc as FugueDoc
            if (log.type == "fuguedeldoc") block.style.border = "4px dashed red"
            if (log.type == "fugueinsdoc") block.style.border = "4px dashed green"

            block.innerHTML += `Agent: ${doc.agent}`
            if (doc) {
                block.innerHTML += createFugueDocViewer(log).innerHTML
            }
            block.innerHTML += `<pre>${syntaxHighlight(doc.version)}</pre>`
            block.innerHTML += `Content: ${getContent(doc)}`
        }
        else if (typeof log === 'object' && log !== null && log.oplog) {
            block.innerHTML += `<pre>${syntaxHighlight(log.oplog)}</pre>`
            // block.innerHTML += toDotSrc(log.oplog)
            block.innerHTML += renderGraphAndGetInnerHTML(toDotSrc(log.oplog))
            block.innerHTML += createEgwalkerDocViewer(log.oplog).innerHTML
        }
        else if (typeof log === 'object' && log !== null) {
            block.innerHTML += `<pre>${syntaxHighlight(log)}</pre>`
        }
        else {
            block.innerHTML += `<p>${String(log)}</p>`
        }

        container.appendChild(block)
    }

    HISTORY_LOG_ELEMENTS.push(container)
}

let historyTabs: HTMLElement | null = null
let historyContent: HTMLElement | null = null
const historyMap = new Map<string, HTMLElement[]>()

let tabCount = 0

export function InitHistory() {
    historyTabs = document.getElementById("historyTabs")!
    historyContent = document.getElementById("historyContent")!

    historyTabs.innerHTML = ""
    historyContent.innerHTML = ""
}

export function createHistoryTab(historyElements: HTMLElement[], opname: string) {
    const tabId = `tab-${++tabCount}`
    historyMap.set(tabId, historyElements.map(el => el.cloneNode(true) as HTMLDivElement))

    const tab = document.createElement("div")
    tab.textContent = opname
    tab.className = "tab"
    tab.dataset.id = tabId
    tab.onclick = () => switchTab(tabId)

    historyTabs!.appendChild(tab)
    switchTab(tabId)
}

function switchTab(tabId: string) {
    document.querySelectorAll("#historyTabs .tab").forEach(tab => {
        const htmlTab = tab as HTMLElement
        htmlTab.classList.toggle("active", htmlTab.dataset.id === tabId)
    })

    historyContent!.innerHTML = ""
    const elements = historyMap.get(tabId) || []
    elements.forEach(elem => historyContent!.appendChild(elem.cloneNode(true)))
}

export function syntaxHighlight(obj: any) {
    const json = JSON.stringify(obj, itemReplacer, 2)
    return json.replace(/("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"|\b\d+\.?\d*|\btrue\b|\bfalse\b|\bnull\b)/g, match => {
        let cls = 'number'
        if (/^"/.test(match)) {
            cls = /:$/.test(match) ? 'key' : 'string'
        } else if (/true|false/.test(match)) {
            cls = 'boolean'
        } else if (/null/.test(match)) {
            cls = 'null'
        }
        return `<span class="json-${cls}">${match}</span>`
    })
}

function idToString(id: Id | null): string | null {
    return String(id)
    // return id ? `${id[0]}:${id[1]}` : null;
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