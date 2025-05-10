import { dia, shapes } from '@joint/core';
import { cloneDoc, FugueDoc, FugueItem } from './fugue/types';
import { Id } from './types';
import { EgwalkerDoc, OpLog } from './egwalker/types';

const docColorMap = new Map<string, string>

type FugueLog = {
    type: "fugueinsdoc" | "fuguedeldoc",
    doc: FugueDoc,
    originleft: number,
    originright: number,
    destIdx: number,
    newItem: FugueItem,
    highlight: number
};

export function createFugueDocViewer(log: FugueLog): HTMLDivElement {

    const doc: FugueDoc = cloneDoc(log.doc)

    doc.content.splice(0, 0, {
        content: "start",
        id: ["#", 0],
        originLeft: null,
        originRight: null,
        deleted: false
    })
    doc.content.push({
        content: "end",
        id: ["#", doc.content.length],
        originLeft: null,
        originRight: null,
        deleted: false
    })

    generateVersionColorMap(doc, docColorMap);

    // Create container for this paper
    const paperWrapper = document.createElement('div');

    const paperElement = document.createElement('div');
    paperElement.style.width = '100%';
    paperElement.style.height = '100px';
    paperElement.classList.add('doc-paper');

    paperWrapper.appendChild(paperElement);

    const graph = new dia.Graph();

    new dia.Paper({
        el: paperElement,
        model: graph,
        width: 5000,
        height: 200,
        gridSize: 10,
        interactive: false,
    });

    // Render content
    const idMap = new Map<string, dia.Element>();

    doc.content.forEach((item, index) => {
        const { idStr, rect } = drawItem(item, index, log?.highlight != null ? index == (log.highlight + 1) : false, 50, 0, 100, graph);
        idMap.set(idStr, rect);
    });

    doc.content.forEach((item, index) => {
        const idStr = `${item.id[0]}:${item.id[1]}`;
        drawLink(item, idMap.get(idStr), idMap, doc, graph, log?.destIdx != null ? ((log.destIdx + 1) == index) : false)
    });

    if (log?.newItem && log?.destIdx != null) {
        let item = drawItem(log.newItem, log.destIdx, true, 50, 25, 20, graph)
        drawLink(log.newItem, item.rect, idMap, doc, graph, true)
    }

    return paperWrapper
}

// type EgwalkerLog = {
//     type: "egwalkerinsdoc" | "egwalkerdeldoc",
//     doc: EgwalkerDoc,
//     originleft: number,
//     originright: number,
//     destIdx: number,
//     highlight: number,
// };

export function createEgwalkerDocViewer(log: OpLog<string>): HTMLDivElement {

    console.log(log)

    const paperWrapper = document.createElement('div');

    const paperElement = document.createElement('div');
    paperElement.style.width = '100%';
    paperElement.style.height = '100px';
    paperElement.classList.add('doc-paper');

    paperWrapper.appendChild(paperElement);

    const graph = new dia.Graph();

    new dia.Paper({
        el: paperElement,
        model: graph,
        width: 5000,
        height: 200,
        gridSize: 10,
        interactive: false,
    });

    return paperWrapper
}

function drawItem(
    item: FugueItem,
    index: number,
    highlight: boolean,
    spacing: number,
    x: number,
    y: number,
    graph: dia.Graph) {
    const idStr = `${item.id[0]}:${item.id[1]}`;
    const rect = new shapes.standard.Rectangle();
    rect.position(index * spacing + 10 + x, y);
    rect.resize(40, 40);
    rect.attr({
        body: {
            fill: ((item.deleted || item.id[0] == "#")
                ? '#f88'
                : docColorMap.get(item.id[0])),
            stroke: highlight ? "#f00" : '#000',
            strokeWidth: highlight ? 4 : 1,
        },
        label: {
            text: item.id[0] == "#" ? `${index - 1}` : `${item.content}\n${idStr}\n${index - 1}`,
            fontSize: 12,
            fill: '#000',
        },
    });

    rect.addTo(graph);
    return { idStr, rect };
}

let rtx = 5

function drawLink(
    item: FugueItem,
    current: dia.Element | undefined,
    idMap: Map<string, dia.Element>,
    doc: FugueDoc,
    graph: dia.Graph,
    solid: boolean) {
    if (!current || item.id[0] == "#") return;

    const getIdStr = (id: Id) => `${id[0]}:${id[1]}`;

    let idMapHasItem = idMap.has(getIdStr(item.id))

    rtx = (rtx + 7) % 35
    let rpx = idMapHasItem ? rtx - 17 : 0
    let rpy = idMapHasItem ? rtx : 0
    let rcol = generateLightHSL()

    const originLeftStr = getIdStr(item.originLeft ?? ["#", 0]);
    if (originLeftStr && idMap.has(originLeftStr)) {
        const source = idMap.get(originLeftStr)!;

        const sourceCenter = source.getBBox().center();
        const targetCenter = current.getBBox().center();

        const link = new shapes.standard.Link();
        link.source({ x: targetCenter.x + rpx, y: targetCenter.y + 20 });
        link.target({ x: sourceCenter.x + rpx, y: sourceCenter.y + (idMapHasItem ? 20 : -20) });
        link.connector('rounded');

        if (idMapHasItem) {
            // Control points below both boxes
            link.set('vertices', [
                { x: targetCenter.x - 10 + rpx, y: targetCenter.y + 40 + rpy },
                { x: sourceCenter.x + 10 + rpx, y: sourceCenter.y + 40 + rpy },
            ]);
        }

        link.attr({
            line: {
                stroke: rcol,
                strokeWidth: solid ? 3 : 1,
                strokeDasharray: solid ? '' : '4 8',
            },
        });

        link.addTo(graph);
    }

    const originRightStr = getIdStr(item.originRight ?? ["#", doc.content.length - 1]);
    if (originRightStr && idMap.has(originRightStr)) {
        const target = idMap.get(originRightStr)!;

        const sourceCenter = current.getBBox().center();
        const targetCenter = target.getBBox().center();

        const link = new shapes.standard.Link();
        link.source({ x: sourceCenter.x + rpx, y: sourceCenter.y + (idMapHasItem ? -20 : 20) });
        link.target({ x: targetCenter.x + rpx, y: targetCenter.y - 20 });
        link.connector('rounded');

        if (idMapHasItem) {
            // Control points above both boxes
            link.set('vertices', [
                { x: sourceCenter.x + 10 + rpx, y: sourceCenter.y - 40 - rpy },
                { x: targetCenter.x - 10 + rpx, y: targetCenter.y - 40 - rpy },
            ]);
        }

        link.attr({
            line: {
                stroke: rcol, // or '#0074D9' for left
                strokeWidth: solid ? 3 : 1,
                strokeDasharray: solid ? '' : '4 8',
            },
        });

        link.addTo(graph);
    }
}

let HSLcolor = 0
function generateLightHSL() {
    HSLcolor += 40
    const hue = (HSLcolor % 160) + 20 + Math.floor(Math.random() * 140); // Hue ranges from 0 to 360
    const saturation = Math.floor(Math.random() * 30) + 70; // Saturation between 80 and 100 to ensure light color
    const lightness = Math.floor(Math.random() * 30) + 70; // Lightness between 80 and 100 to ensure light color

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function generateVersionColorMap(
    doc: FugueDoc,
    existingMap?: Map<string, string>
): Map<string, string> {
    const colorMap = existingMap ?? new Map<string, string>();

    for (const key of Object.keys(doc.version)) {
        if (!colorMap.has(key)) {
            const color = generateLightHSL();
            colorMap.set(key, color);
        }
    }

    return colorMap;
}
