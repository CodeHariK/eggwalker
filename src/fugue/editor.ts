// This file implements a super simple text editor using textarea on top of the
// CRDT implementation.

import { calcDiff, elemById } from "../editor.js";
import { createHistoryTab, HistoryLog, InitHistory } from "../logs.js"
import { cloneDoc, CRDTDocument } from "./types.js"

const attachEditor = (agentName: string, elemName: string) => {
  const old_elem = elemById(elemName) as HTMLTextAreaElement
  var elem = old_elem.cloneNode(true) as HTMLTextAreaElement;
  old_elem?.parentNode?.replaceChild(elem, old_elem);

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

          if (del > 0) {
            createHistoryTab(history, "del" + agentName)
          } else {
            createHistoryTab(history, "ins" + agentName)
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
    mergeFrom(other: CRDTDocument, opname: string) {

      HistoryLog(...[
        `Merge Dest`,
        { type: "fugueinsdoc", "doc": cloneDoc(doc.doc) },
        `Src`,
        { type: "fugueinsdoc", "doc": cloneDoc(other.doc) }
      ])

      let history = doc.mergeFrom(other)

      createHistoryTab(history, opname)

      elem.value = lastValue = doc.getString()

      history.length = 0
    }
  }
}

export const FUGUE_LOAD = () => {

  InitHistory()

  const one = attachEditor('@1', 'one')
  const two = attachEditor('@2', 'two')
  const three = attachEditor('@3', 'three')

  elemById('reset').onclick = () => {
    one.reset()
    two.reset()
    three.reset()
  }

  elemById('OneMergeTwo').onclick = () => {
    one.mergeFrom(two.doc, 'OneMergeTwo')
  }
  elemById('TwoMergeOne').onclick = () => {
    two.mergeFrom(one.doc, 'TwoMergeOne')
  }

  elemById('OneMergeThree').onclick = () => {
    one.mergeFrom(three.doc, 'OneMergeThree')
  }
  elemById('ThreeMergeOne').onclick = () => {
    three.mergeFrom(one.doc, 'ThreeMergeOne')
  }

  elemById('TwoMergeThree').onclick = () => {
    two.mergeFrom(three.doc, 'TwoMergeThree')
  }
  elemById('ThreeMergeTwo').onclick = () => {
    three.mergeFrom(two.doc, 'ThreeMergeTwo')
  }

  console.log("FUGUE")
}
