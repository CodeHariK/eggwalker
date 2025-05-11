import { dia, shapes } from '@joint/core';
import { cloneDoc, FugueDoc, FugueItem } from './fugue/types';
import { Id } from './types';
import { EgwalkerDoc, OpInner, OpLog } from './egwalker/types';

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

// Create a custom shape for operations
const OpShape = dia.Element.define('op.Shape', {
    attrs: {
        body: {
            refWidth: '100%',
            refHeight: '100%',
            strokeWidth: 1,
            rx: 5,
            ry: 5,
            fill: '#ffffff',
            stroke: '#000000',
        },
        label: {
            textVerticalAnchor: 'middle',
            textAnchor: 'middle',
            refX: '50%',
            refY: '50%',
            fontSize: 12,
            fill: '#333333',
        },
        icon: {
            refX: 5,
            refY: 5,
            fontSize: 14,
        }
    }
}, {
    markup: [{
        tagName: 'rect',
        selector: 'body'
    }, {
        tagName: 'text',
        selector: 'label'
    }, {
        tagName: 'text',
        selector: 'icon'
    }]
});

export function createEgwalkerDocViewer(log: OpLog<string>): HTMLDivElement {
    // Create container for the viewer
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.width = '100%';
    container.style.height = '500px';
    container.style.border = '1px solid #ccc';
    container.style.borderRadius = '5px';
    container.style.overflow = 'hidden';

    // Create header
    const header = document.createElement('div');
    header.style.padding = '10px';
    header.style.borderBottom = '1px solid #ccc';
    header.style.backgroundColor = '#f5f5f5';
    header.textContent = 'Operation Log Viewer';
    container.appendChild(header);

    // Create container for the graph
    const graphContainer = document.createElement('div');
    graphContainer.style.flex = '1';
    graphContainer.style.overflow = 'auto';
    container.appendChild(graphContainer);

    // Create JointJS graph
    const graph = new dia.Graph();

    const paper = new dia.Paper({
        el: graphContainer,
        model: graph,
        width: 5000,
        height: 400,
        gridSize: 10,
        interactive: true,
        background: {
            color: '#f8f9fa',
        },
    });

    // Add zoom controls
    paper.scale(1);
    paper.on('blank:mousewheel', (evt, x, y, delta) => {
        evt.preventDefault();
        const currentScale = paper.scale().sx;
        const newScale = Math.max(0.5, Math.min(2, currentScale + delta * 0.1));
        paper.scale(newScale);
    });

    // Render the operations
    renderOpLog(graph, log);

    // Add info section
    const infoSection = document.createElement('div');
    infoSection.style.padding = '10px';
    infoSection.style.borderTop = '1px solid #ccc';
    infoSection.style.backgroundColor = '#f5f5f5';

    const frontierInfo = document.createElement('div');
    frontierInfo.textContent = `Frontier: [${log.frontier.join(', ')}], depth:${calculateDepth(log)}`;
    infoSection.appendChild(frontierInfo);

    const versionInfo = document.createElement('div');
    versionInfo.textContent = `Version: ${JSON.stringify(log.version)}`;
    infoSection.appendChild(versionInfo);

    container.appendChild(infoSection);

    return container;
}

// function renderOpLog(graph: dia.Graph, log: OpLog<string>): void {
//     const elements: dia.Element[] = [];
//     const links: dia.Link[] = [];

//     const idMap = new Map<string, dia.Element>();

//     const depths = calculateDepth(log);
//     const verticalSpacing = 100;
//     const horizontalSpacing = 200;

//     const originToIndices: Record<string, number[]> = {};
//     log.ops.forEach((op, i) => {
//         const origin = op.id[0];
//         if (!originToIndices[origin]) originToIndices[origin] = [];
//         originToIndices[origin].push(i);
//     });
//     const originList = Object.keys(originToIndices);
//     const originX: Record<string, number> = {};
//     originList.forEach((origin, i) => {
//         originX[origin] = i * horizontalSpacing;
//     });

//     const allIndices = new Set<number>();

//     log.ops.forEach((op, index) => {
//         allIndices.add(index);
//         op.parents.forEach(parent => {
//             allIndices.add(parent);
//         });
//     });

//     for (const index of allIndices) {
//         const op = log.ops[index];

//         // If the op is undefined (i.e., structural merge point with no op),
//         // create a dummy merge node
//         const isDummy = !op;
//         const labelText = isDummy
//             ? 'Merge'
//             : op.type === 'ins'
//                 ? `+ "${(op as OpInner<string> & { type: 'ins' }).content}" @ ${op.pos}`
//                 : `- Del @ ${op.pos}`;

//         const fillColor = isDummy ? '#f0f0f0'
//             : op.type === 'ins' ? '#e3f2fd'
//                 : '#ffebee';

//         const strokeColor = isDummy ? '#9e9e9e'
//             : op.type === 'ins' ? '#2196f3'
//                 : '#f44336';

//         const element = new shapes.standard.Rectangle({
//             id: `op-${index}`,
//             position: { x: 0, y: 0 }, // layout will be updated later
//             size: { width: 120, height: 50 },
//             attrs: {
//                 body: {
//                     fill: fillColor,
//                     stroke: strokeColor,
//                     strokeWidth: 2,
//                     rx: 5,
//                     ry: 5,
//                 },
//                 label: {
//                     text: labelText,
//                     fill: '#333',
//                     fontSize: 12,
//                     textAnchor: 'middle',
//                     textVerticalAnchor: 'middle',
//                 }
//             }
//         });

//         elements.push(element);
//         console.log(index)
//         idMap.set(`op-${index}`, element);
//     }

//     elements.forEach((element, index) => {
//         const op = log.ops[index];
//         const depth = depths[index];
//         let x: number;

//         if (op.parents.length > 1) {
//             const parentXs = op.parents.map(p => elements[p].position().x);
//             const avgX = parentXs.reduce((a, b) => a + b, 0) / parentXs.length;
//             x = avgX;
//         } else {
//             x = originX[op.id[0]];
//         }

//         const y = depth * verticalSpacing;
//         element.position(x, y);
//     });

//     // Create links
//     // log.ops.forEach((op, index) => {
//     //     op.parents.forEach(parentIndex => {
//     //         if (parentIndex >= 0 && parentIndex < log.ops.length) {

//     //             const source = idMap.get(`op-${parentIndex}`);
//     //             const target = idMap.get(`op-${index}`);
//     //             if (!source || !target) return;

//     //             const sourceCenter = source.getBBox().center();
//     //             const targetCenter = target.getBBox().center();

//     //             const link = new shapes.standard.Link({
//     //                 source: { x: sourceCenter.x, y: sourceCenter.y },
//     //                 target: { x: targetCenter.x, y: targetCenter.y },
//     //                 attrs: {
//     //                     line: {
//     //                         stroke: '#999',
//     //                         strokeWidth: 2,
//     //                         targetMarker: {
//     //                             type: 'path',
//     //                             d: 'M 10 -5 0 0 10 5 z',
//     //                             fill: '#333'
//     //                         }
//     //                     }
//     //                 },
//     //                 connector: { name: 'smooth' },
//     //                 router: { name: 'orthogonal' },
//     //                 markup: [
//     //                     {
//     //                         tagName: 'path',
//     //                         selector: 'line',
//     //                         attributes: {
//     //                             fill: 'none',
//     //                             stroke: '#999',
//     //                             'stroke-width': 2
//     //                         }
//     //                     },
//     //                     {
//     //                         tagName: 'path',
//     //                         selector: 'targetMarker',
//     //                         attributes: {
//     //                             d: 'M 10 -5 0 0 10 5 z',
//     //                             fill: '#333',
//     //                             stroke: 'none'
//     //                         }
//     //                     }
//     //                 ]
//     //             });

//     //             links.push(link);
//     //         }
//     //     });
//     // });

//     graph.resetCells([...elements, ...links]);
// }

function renderOpLog(graph: dia.Graph, log: OpLog<string>): void {
    const elements: dia.Element[] = [];
    const links: dia.Link[] = [];
    const idMap = new Map<string, dia.Element>();

    // Clone original ops so we can add synthetic merge nodes
    const extendedOps: (typeof log.ops[number] | { type: 'merge'; id: [string, number]; pos: -1; parents: number[] })[] = [...log.ops];
    const mergeNodeMap = new Map<string, number>(); // Key: parent ids string, Value: synthetic index

    // Insert merge nodes for multi-parent ops
    for (let i = 0; i < extendedOps.length; i++) {
        const op = extendedOps[i];
        if (op.parents.length > 1) {
            const key = op.parents.sort((a, b) => a - b).join(',');
            if (!mergeNodeMap.has(key)) {
                const mergeIndex = extendedOps.length;
                mergeNodeMap.set(key, mergeIndex);
                extendedOps.push({
                    type: 'merge',
                    id: ['merge', mergeIndex],
                    pos: -1,
                    parents: op.parents
                });
            }

            // Update current op to use the merge node as parent
            const mergeIndex = mergeNodeMap.get(key)!;
            op.parents = [mergeIndex];
        }
    }

    // Create elements
    extendedOps.forEach((op, index) => {
        let element: dia.Element;
        const isInsert = op.type === 'ins';
        const isDelete = op.type === 'del';
        const isMerge = op.type === 'merge';

        let labelText = '';
        if (isInsert) {
            labelText = `+ "${(op as any).content}" @ ${op.pos}`;
        } else if (isDelete) {
            labelText = `- Del @ ${op.pos}`;
        } else if (isMerge) {
            labelText = `Merge\n[${op.parents.join(', ')}]`;
        }

        element = new shapes.standard.Rectangle({
            id: `op-${index}`,
            position: { x: 0, y: 0 },
            size: { width: 120, height: 50 },
            attrs: {
                body: {
                    fill: isInsert ? '#e3f2fd' : isDelete ? '#ffebee' : '#eeeeee',
                    stroke: isInsert ? '#2196f3' : isDelete ? '#f44336' : '#888',
                    strokeWidth: 2,
                    rx: 5,
                    ry: 5
                },
                label: {
                    text: labelText,
                    fill: '#333',
                    fontSize: 12,
                    textAnchor: 'middle',
                    textVerticalAnchor: 'middle'
                }
            }
        });

        // Highlight frontier
        if (log.frontier.includes(index)) {
            element.attr('body/strokeWidth', 3);
            element.attr('body/stroke', '#4caf50');
        }

        elements.push(element);
        idMap.set(`op-${index}`, element);
    });

    // Layout
    const depths = calculateDepth({ ops: extendedOps });
    const verticalSpacing = 100;
    const horizontalSpacing = 180;

    const originToIndices: Record<string, number[]> = {};
    extendedOps.forEach((op, i) => {
        const origin = op.id[0];
        if (!originToIndices[origin]) originToIndices[origin] = [];
        originToIndices[origin].push(i);
    });

    const originList = Object.keys(originToIndices);
    const originX: Record<string, number> = {};
    originList.forEach((origin, i) => {
        originX[origin] = i * horizontalSpacing;
    });

    elements.forEach((element, index) => {
        const op = extendedOps[index];
        const depth = depths[index];
        let x: number;

        if (op.parents.length > 1) {
            const parentXs = op.parents.map(p => elements[p]?.position().x ?? 0);
            x = parentXs.reduce((a, b) => a + b, 0) / parentXs.length;
        } else {
            x = originX[op.id[0]] ?? 0;
        }

        const y = depth * verticalSpacing;
        element.position(x, y);
    });

    // Create links
    extendedOps.forEach((op, index) => {
        op.parents.forEach(parentIndex => {
            const source = idMap.get(`op-${parentIndex}`);
            const target = idMap.get(`op-${index}`);
            if (!source || !target) return;

            const link = new shapes.standard.Link({
                source: { id: `op-${parentIndex}` },
                target: { id: `op-${index}` },
                attrs: {
                    line: {
                        stroke: '#999',
                        strokeWidth: 2,
                        targetMarker: {
                            type: 'path',
                            d: 'M 10 -5 0 0 10 5 z',
                            fill: '#333'
                        }
                    }
                },
                connector: { name: 'smooth' },
                router: { name: 'orthogonal' }
            });

            links.push(link);
        });
    });

    graph.resetCells([...elements, ...links]);
}

function calculateDepth(log: { ops: { parents: number[] }[] }): number[] {
    const depths = new Array(log.ops.length).fill(0);
    const visited = new Array(log.ops.length).fill(false);

    function dfs(index: number): number {
        if (visited[index]) return depths[index];
        visited[index] = true;

        const parents = log.ops[index].parents;
        let maxDepth = 0;
        for (const p of parents) {
            if (p >= 0 && p < log.ops.length) {
                maxDepth = Math.max(maxDepth, dfs(p) + 1);
            }
        }

        depths[index] = maxDepth;
        return maxDepth;
    }

    for (let i = 0; i < log.ops.length; i++) {
        dfs(i);
    }

    return depths;
}

// export function calculateDepth(log: OpLog<string>): number[] {
//     const depthMap: number[] = [];

//     function dfs(index: number): number {
//         if (depthMap[index] != null) {
//             return depthMap[index];
//         }

//         const op = log.ops[index];
//         if (op.parents.length === 0) {
//             depthMap[index] = 0;
//         } else {
//             depthMap[index] = 1 + Math.max(...op.parents.map(dfs));
//         }

//         return depthMap[index];
//     }

//     for (let i = 0; i < log.ops.length; i++) {
//         dfs(i);
//     }

//     console.log(depthMap)

//     return depthMap;
// }

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
