import { EGWALKER_LOAD } from "./egwalker/editor"
import { FUGUE_LOAD } from "./fugue/editor"

import graphviz from 'graphviz-wasm';
import { createEgwalkerDocViewer } from "./render";
import { OpLog } from "./egwalker/types";
import { renderGraphAndGetInnerHTML, toDotSrc } from "./egwalker/dot";

graphviz.loadWASM()

let EGWALKER = true

function Start(b: HTMLElement) {

    if (EGWALKER) {
        EGWALKER_LOAD()
        b.textContent = "EGWALKER"
    } else {
        FUGUE_LOAD()
        b.textContent = "FUGUE"
    }
}


let oppa: OpLog<string> = {
    "ops": [
        {
            "type": "ins",
            "content": "a",
            "pos": 0,
            "id": ["@1", 0],
            "parents": []
        },
        {
            "type": "ins",
            "content": "b",
            "pos": 1,
            "id": ["@1", 1],
            "parents": [
                0
            ]
        },
        {
            "type": "ins",
            "content": "x",
            "pos": 0,
            "id": ["@2", 0],
            "parents": []
        },
        {
            "type": "del",
            "pos": 1,
            "id": ["@1", 2],
            "parents": [
                1,
                2
            ]
        },
        {
            "type": "ins",
            "content": "H",
            "pos": 2,
            "id": ["@1", 3],
            "parents": [
                3
            ]
        },
        {
            "type": "ins",
            "content": "M",
            "pos": 3,
            "id": ["@2", 1],
            "parents": [
                1,
                2
            ]
        }
    ],
    "frontier": [
        4,
        5
    ],
    "version": {
        "@1": 3,
        "@2": 1
    }
}


window.onload = () => {
    let b = document.getElementById("Switch")!
    b.onclick = () => { EGWALKER = !EGWALKER; Start(b) }
    Start(b)

    document.body.innerHTML = renderGraphAndGetInnerHTML(toDotSrc(oppa))
    document.body.innerHTML += createEgwalkerDocViewer(oppa).innerHTML
    document.body.style.overflow = "scroll"
}
