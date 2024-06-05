/*==============================================================================

Flatmap viewer and annotation tool

Copyright (c) 2019 - 2024  David Brooks

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

==============================================================================*/

import {MapServer} from '../mapserver'
import {DiGraph, NodeLinkGraph} from './graphs'

//==============================================================================

const MULTICELLULAR_ORGANISM = 'UBERON:0000468'

export const ANATOMICAL_ROOT = MULTICELLULAR_ORGANISM

//==============================================================================

export class MapTermGraph
{
    #hierarchy: DiGraph = new DiGraph()

    load(termGraph: NodeLinkGraph)
    //============================
    {
        this.#hierarchy.load(termGraph)
    }

    connectedTermGraph(terms: string[])
    //=================================
    {
        return this.#hierarchy.connectedSubgraph(terms)
    }

    depth(term: string): number
    //=========================
    {
        return this.#hierarchy.getNodeAttribute(term, 'distance') as number
    }

    hasTerm(term: string): boolean
    //============================
    {
        return this.#hierarchy.hasNode(term)
    }
}

//==============================================================================

class SparcTermGraph
{
    static #instance: SparcTermGraph|null = null
    #graph: DiGraph = new DiGraph()

    constructor()
    {
        if (SparcTermGraph.#instance) {
            throw new Error('Use SparcTermGraph.instance() instead of `new`')
        }
        SparcTermGraph.#instance = this
    }

    static instance()
    {
        return SparcTermGraph.#instance ?? (SparcTermGraph.#instance = new SparcTermGraph())
    }

    async load(mapServer: MapServer)
    //==============================
    {
        const sparcGraph = await mapServer.loadJSON('knowledge/sparcterms')
        this.#graph.load(sparcGraph)
    }

    parents(term: string): string[]
    //=============================
    {
        return this.#graph.parents(term)
    }
}

//==============================================================================

export const sparcTermGraph = SparcTermGraph.instance()

//==============================================================================