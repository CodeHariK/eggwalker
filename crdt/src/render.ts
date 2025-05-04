import { dia, shapes } from '@joint/core';
import { Doc, Id } from "./crdt";

export function createDocViewer(doc: Doc,): HTMLDivElement {
    // Create container for this paper
    const paperWrapper = document.createElement('div');

    const paperElement = document.createElement('div');
    paperElement.style.width = '100%';
    paperElement.style.height = '100px';
    paperElement.classList.add('doc-paper');

    paperWrapper.appendChild(paperElement);

    // Create graph and paper
    const graph = new dia.Graph();

    const paper = new dia.Paper({
        el: paperElement,
        model: graph,
        width: 5000,
        height: 100,
        gridSize: 10,
        interactive: false,
    });

    // Render content
    const idMap = new Map<string, dia.Element>();
    const spacing = 50;
    const y = 30;

    doc.content.forEach((item, index) => {
        const idStr = `${item.id[0]}:${item.id[1]}`;
        const rect = new shapes.standard.Rectangle();
        rect.position(index * spacing + 10, y);
        rect.resize(40, 40);
        rect.attr({
            body: {
                fill: item.deleted ? '#f88' : '#fff',
                stroke: '#000',
            },
            label: {
                text: `${item.content}\n${idStr}`,
                fontSize: 12,
                fill: '#000',
            },
        });

        rect.addTo(graph);
        idMap.set(idStr, rect);
    });

    doc.content.forEach((item) => {
        const idStr = `${item.id[0]}:${item.id[1]}`;
        const current = idMap.get(idStr);
        if (!current) return;

        const getIdStr = (id: Id | null) => id ? `${id[0]}:${id[1]}` : null;

        let rpx = Math.random() * 20 - 10
        let rcol = getRandomColorHex()

        const originLeftStr = getIdStr(item.originLeft);
        if (originLeftStr && idMap.has(originLeftStr)) {
            const source = idMap.get(originLeftStr)!;

            const sourceCenter = source.getBBox().center();
            const targetCenter = current.getBBox().center();

            const link = new shapes.standard.Link();
            link.source({ x: sourceCenter.x + rpx, y: sourceCenter.y + 20 });
            link.target({ x: targetCenter.x + rpx, y: targetCenter.y + 20 });
            link.connector('rounded');

            // Control points below both boxes
            link.set('vertices', [
                { x: sourceCenter.x + 10 + rpx, y: sourceCenter.y + 40 + rpx },
                { x: targetCenter.x - 10 + rpx, y: targetCenter.y + 40 + rpx },
            ]);

            link.attr({
                line: {
                    stroke: rcol,
                    strokeWidth: 1,
                    // strokeDasharray: '5 5', // dotted line
                    sourceMarker: {
                        d: '', // remove default arrow
                    },
                    targetMarker: {
                        d: '', // remove default arrow
                    },
                },
            });

            link.addTo(graph);
        }

        const originRightStr = getIdStr(item.originRight);
        if (originRightStr && idMap.has(originRightStr)) {
            const target = idMap.get(originRightStr)!;

            const sourceCenter = current.getBBox().center();
            const targetCenter = target.getBBox().center();

            const link = new shapes.standard.Link();
            link.source({ x: sourceCenter.x + rpx, y: sourceCenter.y - 20 });
            link.target({ x: targetCenter.x + rpx, y: targetCenter.y - 20 });
            link.connector('rounded');

            // Control points above both boxes
            link.set('vertices', [
                { x: sourceCenter.x + 10 + rpx, y: sourceCenter.y - 40 + rpx },
                { x: targetCenter.x - 10 + rpx, y: targetCenter.y - 40 + rpx },
            ]);

            link.attr({
                line: {
                    stroke: rcol, // or '#0074D9' for left
                    strokeWidth: 1,
                    // strokeDasharray: '5 5', // dotted line
                    sourceMarker: {
                        d: '', // remove default arrow
                    },
                    targetMarker: {
                        d: '', // remove default arrow
                    },
                },
            });

            link.addTo(graph);
        }
    });

    return paperWrapper
}

function getRandomColorHex() {
    return '#' + Math.floor(Math.random() * 16777215).toString(16);
}