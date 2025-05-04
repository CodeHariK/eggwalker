import { syntaxHighlight } from "./editor"
import { createDocViewer } from "./render"

export const HISTORY_LOG_ELEMENTS: HTMLDivElement[] = []

export function HistoryLog(...data: any[]) {
    const container = document.createElement("div")
    container.className = "history-entry"

    data.forEach((d) => {
        const block = document.createElement("div")

        if (typeof d === 'object' && d !== null && d.type === "doc") {
            let rdoc = createDocViewer(d.doc)
            block.innerHTML = rdoc.innerHTML
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
