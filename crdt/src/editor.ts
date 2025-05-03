// This file implements a super simple text editor using textarea on top of the
// CRDT implementation.

import { CRDTDocument, getContent, HistoryLog } from "./crdt.js"

type DiffResult = { pos: number, del: number, ins: string }

// This is a very simple diff function. Notably it doesn't take into account
// the user's cursor position - so as you type "aaaaa", we can't tell which
// "a" you've just inserted each time.
const calcDiff = (oldval: string, newval: string): DiffResult => {
  // Strings are immutable and have reference equality. I think this test is O(1), so its worth doing.
  if (oldval === newval) return { pos: 0, del: 0, ins: '' }

  let oldChars = [...oldval]
  let newChars = [...newval]

  var commonStart = 0;
  while (oldChars[commonStart] === newChars[commonStart]) {
    commonStart++;
  }

  var commonEnd = 0;
  while (oldChars[oldChars.length - 1 - commonEnd] === newChars[newChars.length - 1 - commonEnd] &&
    commonEnd + commonStart < oldChars.length && commonEnd + commonStart < newChars.length) {
    commonEnd++;
  }

  const del = (oldChars.length !== commonStart + commonEnd)
    ? oldChars.length - commonStart - commonEnd
    : 0
  const ins = (newChars.length !== commonStart + commonEnd)
    ? newChars.slice(commonStart, newChars.length - commonEnd).join('')
    : ''

  return {
    pos: commonStart, del, ins
  }
}

const elemById = (name: string): HTMLElement => {
  const elem = document.getElementById(name)
  if (elem == null) throw Error('Missing element ' + name)
  return elem
}

const attachEditor = (agentName: string, elemName: string) => {
  const elem = elemById(elemName) as HTMLTextAreaElement

  const doc = new CRDTDocument(agentName)
  let lastValue = doc.getString()
  elem.value = lastValue;

  ['textInput', 'keydown', 'keyup', 'select', 'cut', 'paste', 'input'].forEach(eventName => {
    elem.addEventListener(eventName, _e => {
      setTimeout(() => {
        // assert(vEq(doc.getLocalVersion(), last_version))
        let newValue = elem.value.replace(/\r\n/g, '\n')
        if (newValue !== lastValue) {
          let { pos, del, ins } = calcDiff(lastValue, newValue)

          HistoryLog(`state ${agentName} ${lastValue}`)

          let history: HTMLDivElement[] = []

          if (del > 0) {
            history = doc.del(pos, del)
          }
          if (ins !== '') {
            history = doc.ins(pos, ins)
          }

          if (doc.getString() != newValue) throw Error('Diff invalid - document does not match')

          // last_version = doc.getLocalVersion()
          lastValue = newValue

          HistoryLog(`state ${agentName} ${lastValue}`)

          if (del > 0) {
            createHistoryTab(history, "del")
          } else {
            createHistoryTab(history, "ins")
          }
          history.length = 0
        }
      }, 0)
    }, false)
  })

  return {
    doc,
    reset() {
      doc.reset()
      elem.value = lastValue = doc.getString()
    },
    print() {
      console.log(doc)
    },
    mergeFrom(other: CRDTDocument, opname: string) {

      HistoryLog({
        "Merge": "",
        "Dest": agentName + " (" + getContent(doc.doc) + ")",
        "src": other.agent + " (" + getContent(other.doc) + ")",
      })

      let history = doc.merge(other)

      HistoryLog(`${agentName} merge ${other.agent} ${doc.getString()}`)

      createHistoryTab(history, opname)

      elem.value = lastValue = doc.getString()

      history.length = 0
    }
  }
}

window.onload = () => {
  const a = attachEditor('@1', 'text1')
  const b = attachEditor('@2', 'text2')

  elemById('reset').onclick = () => {
    a.reset()
    b.reset()
  }

  elemById('pushLeft').onclick = () => {
    a.mergeFrom(b.doc, "pushLeft")
  }
  elemById('pushRight').onclick = () => {
    b.mergeFrom(a.doc, "pushRight")
  }
  elemById('print').onclick = () => {
    a.print()
    b.print()
  }
}


let tabCount = 0
let activeTabId = null
const historyTabs = document.getElementById("historyTabs")!
const historyContent = document.getElementById("historyContent")!

const historyMap = new Map<string, HTMLElement[]>()

function createHistoryTab(historyElements: HTMLElement[], opname: string) {
  const tabId = `tab-${++tabCount}`
  historyMap.set(tabId, historyElements.map(el => el.cloneNode(true) as HTMLDivElement))

  const tab = document.createElement("div")
  tab.textContent = opname
  tab.className = "tab"
  tab.dataset.id = tabId
  tab.onclick = () => switchTab(tabId)

  historyTabs.appendChild(tab)
  switchTab(tabId)
}

function switchTab(tabId: string) {
  activeTabId = tabId
  document.querySelectorAll("#historyTabs .tab").forEach(tab => {
    const htmlTab = tab as HTMLElement
    htmlTab.classList.toggle("active", htmlTab.dataset.id === tabId)
  })

  historyContent.innerHTML = ""
  const elements = historyMap.get(tabId) || []
  elements.forEach(elem => historyContent.appendChild(elem.cloneNode(true)))
}

export function syntaxHighlight(obj: any) {
  const json = JSON.stringify(obj, null, 2)
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
