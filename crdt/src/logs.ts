import { getContent } from "./crdt"
import { syntaxHighlight } from "./editor"
import { createDocViewer } from "./render"
import { Doc } from "./types"

export const HISTORY_LOG_ELEMENTS: HTMLDivElement[] = []

export function HistoryLog(...data: any[]) {
    const container = document.createElement("div")
    container.className = "history-entry"

    data.forEach((d) => {
        const block = document.createElement("div")
        block.classList.add("doc-object")

        if (typeof d === 'object' && d !== null && d.type === "doc") {
            let doc = d.doc as Doc
            let rdoc
            if (d.ins) {
                rdoc = createDocViewer(doc, d.highlight, d.ins)
            } else {
                rdoc = createDocViewer(doc, d.highlight, null)
            }
            if (d.op == "del") block.style.border = "4px dashed red"
            if (d.op == "ins") block.style.border = "4px dashed green"
            block.innerHTML += `Agent: ${doc.agent}`
            block.innerHTML += rdoc.innerHTML
            block.innerHTML += `<pre>${syntaxHighlight(doc.version)}</pre>`
            block.innerHTML += `Content: ${getContent(doc)}`
        }
        else if (typeof d === 'object' && d !== null) {
            block.className = "log-object"
            block.innerHTML = `<pre>${syntaxHighlight(d)}</pre>`
        }
        else {
            block.className = "log-text"
            block.textContent = String(d)
        }

        container.appendChild(block)
    })

    HISTORY_LOG_ELEMENTS.push(container)
}
