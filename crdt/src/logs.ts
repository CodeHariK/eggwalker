import { getContent } from "./crdt"
import { syntaxHighlight } from "./editor"
import { createDocViewer } from "./render"
import { Doc } from "./types"

export const HISTORY_LOG_ELEMENTS: HTMLDivElement[] = []

export function HistoryLog(...logs: any[]) {
    const container = document.createElement("div")
    container.className = "history-entry"

    const block = document.createElement("div")
    block.classList.add("doc-object")

    logs.forEach((log) => {

        if (typeof log === 'object' && log !== null && (log.type === "insdoc" || log.type === "deldoc")) {
            let doc = log.doc as Doc
            if (log.type == "deldoc") block.style.border = "4px dashed red"
            if (log.type == "insdoc") block.style.border = "4px dashed green"

            block.innerHTML += `Agent: ${doc.agent}`
            if (doc) {
                block.innerHTML += createDocViewer(log).innerHTML
            }
            block.innerHTML += `<pre>${syntaxHighlight(doc.version)}</pre>`
            block.innerHTML += `Content: ${getContent(doc)}`
        }
        else if (typeof log === 'object' && log !== null) {
            block.innerHTML += `<pre>${syntaxHighlight(log)}</pre>`
        }
        else {
            block.innerHTML += `<p>${String(log)}</p>`
        }

        container.appendChild(block)
    })

    HISTORY_LOG_ELEMENTS.push(container)
}
