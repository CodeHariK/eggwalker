import { EGWALKER_LOAD } from "./egwalker/editor"
import { FUGUE_LOAD } from "./fugue/editor"

import graphviz from 'graphviz-wasm';
import { createEgwalkerDocViewer } from "./render";
import { renderGraphAndGetInnerHTML, toDotSrc } from "./egwalker/dot";
import { syntaxHighlight } from "./logs";
import { OpLog, splitOpsByAgent } from "./egwalker/types";

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
            "content": "b",
            "pos": 0,
            "id": ["@2", 0],
            "parents": []
        },
        {
            "type": "ins",
            "content": "e",
            "pos": 1,
            "id": ["@2", 1],
            "parents": [
                0
            ]
        },
        {
            "type": "ins",
            "content": "a",
            "pos": 0,
            "id": ["@1", 0],
            "parents": []
        },
        {
            "type": "ins",
            "content": "c",
            "pos": 0,
            "id": ["@3", 0],
            "parents": []
        },
        {
            "type": "ins",
            "content": "d",
            "pos": 1,
            "id": ["@3", 1],
            "parents": [
                3
            ]
        },
        {
            "type": "ins",
            "content": "f",
            "pos": 2,
            "id": ["@3", 2],
            "parents": [
                4
            ]
        },
        {
            "type": "ins",
            "content": "M",
            "pos": 6,
            "id": ["@2", 2],
            "parents": [
                1,
                2,
                5
            ]
        },
        {
            "type": "ins",
            "content": "N",
            "pos": 7,
            "id": ["@2", 3],
            "parents": [
                6
            ]
        },
        {
            "type": "ins",
            "content": "X",
            "pos": 6,
            "id": ["@1", 1],
            "parents": [
                1,
                2,
                5
            ]
        },
        {
            "type": "ins",
            "content": "O",
            "pos": 9,
            "id": ["@3", 3],
            "parents": [
                7,
                8
            ]
        },
        {
            "type": "ins",
            "content": "I",
            "pos": 2,
            "id": ["@2", 4],
            "parents": [
                9
            ]
        },
        {
            "type": "ins",
            "content": "O",
            "pos": 3,
            "id": ["@2", 5],
            "parents": [
                10
            ]
        },
        {
            "type": "ins",
            "content": "A",
            "pos": 5,
            "id": ["@1", 2],
            "parents": [
                9
            ]
        },
        {
            "type": "ins",
            "content": "C",
            "pos": 6,
            "id": ["@1", 3],
            "parents": [
                12
            ]
        }
    ],
    "frontier": [
        11,
        13
    ],
    "version": {
        "@2": 5,
        "@1": 3,
        "@3": 3
    }
}



window.onload = async () => {
    await graphviz.loadWASM()

    let b = document.getElementById("Switch")!
    b.onclick = () => { EGWALKER = !EGWALKER; Start(b) }
    Start(b)

    console.log(splitOpsByAgent(oppa))

    document.body.innerHTML = ""
    document.body.innerHTML += renderGraphAndGetInnerHTML(toDotSrc(oppa))
    document.body.innerHTML += `<pre style="width: 300px;">${syntaxHighlight(oppa)}</pre>`
    // document.body.innerHTML += createEgwalkerDocViewer(oppa).outerHTML
    document.body.style.display = "flex"
    document.body.style.overflow = "scroll"
}
