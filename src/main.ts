import { EGWALKER_LOAD } from "./egwalker/editor"
import { FUGUE_LOAD } from "./fugue/editor"

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

window.onload = () => {
    let b = document.getElementById("Switch")!
    b.onclick = () => { EGWALKER = !EGWALKER; Start(b) }
    Start(b)
}
