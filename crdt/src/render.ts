import { dia, shapes } from '@joint/core';
import { Doc, Id } from './types';

const docColorMap = new Map<string, string>

export function createDocViewer(doc: Doc): HTMLDivElement {

    generateVersionColorMap(doc, docColorMap);

    // Create container for this paper
    const paperWrapper = document.createElement('div');

    const paperElement = document.createElement('div');
    paperElement.style.width = '100%';
    paperElement.style.height = '100px';
    paperElement.classList.add('doc-paper');

    paperWrapper.appendChild(paperElement);

    // Create graph and paper
    const graph = new dia.Graph();

    new dia.Paper({
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
                fill: item.deleted ? '#f88' : docColorMap.get(item.id[0]),
                stroke: '#000',
            },
            label: {
                text: `${item.content}\n${idStr}\n${index}`,
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
        let rcol = generateLightHSL()

        const originLeftStr = getIdStr(item.originLeft);
        if (originLeftStr && idMap.has(originLeftStr)) {
            const source = idMap.get(originLeftStr)!;

            const sourceCenter = source.getBBox().center();
            const targetCenter = current.getBBox().center();

            const link = new shapes.standard.Link();
            link.source({ x: targetCenter.x + rpx, y: targetCenter.y + 20 });
            link.target({ x: sourceCenter.x + rpx, y: sourceCenter.y + 20 });
            link.connector('rounded');

            // Control points below both boxes
            link.set('vertices', [
                { x: targetCenter.x - 10 + rpx, y: targetCenter.y + 40 + rpx },
                { x: sourceCenter.x + 10 + rpx, y: sourceCenter.y + 40 + rpx },
            ]);

            link.attr({
                line: {
                    stroke: rcol,
                    strokeWidth: 1,
                    strokeDasharray: '5 5', // dotted line
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
                },
            });

            link.addTo(graph);
        }
    });

    return paperWrapper
}

function generateLightHSL() {
    const hue = Math.floor(Math.random() * 360); // Hue ranges from 0 to 360
    const saturation = Math.floor(Math.random() * 30) + 70; // Saturation between 80 and 100 to ensure light color
    const lightness = Math.floor(Math.random() * 30) + 70; // Lightness between 80 and 100 to ensure light color

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function generateVersionColorMap(
    doc: Doc,
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
