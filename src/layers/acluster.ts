/*==============================================================================

Flatmap viewer and annotation tool

Copyright (c) 2019 - 2024 David Brooks

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

import {Map as MapLibreMap} from 'maplibre-gl'
import {DataDrivenPropertyValueSpecification, GeoJSONSource} from 'maplibre-gl'

import {SvgManager, SvgTemplateManager} from '../../thirdParty/maplibre-gl-svg/src'

//==============================================================================

import {FlatMap} from '../flatmap-viewer'
import {UserInteractions} from '../interactions'
import {MapTermGraph} from '../knowledge'
import {DatasetMarkerSet} from './anatomical-cluster'

//==============================================================================

export interface Dataset
{
    id: string
    terms: string[]
}

//==============================================================================

const ANATOMICAL_MARKERS_LAYER = 'anatomical-markers-layer'
const ANATOMICAL_MARKERS_SOURCE = 'anatomical-markers-source'

//==============================================================================

const CLUSTERED_MARKER_IMAGE_ID = 'clustered-marker'
const UNCLUSTERED_MARKER_IMAGE_ID = 'unclustered-marker'

export async function loadClusterIcons(map: MapLibreMap)
{
    const markerLargeCircle = `<svg xmlns="http://www.w3.org/2000/svg" width="calc(28 * {scale})" height="calc(39 * {scale})" viewBox="-1 -1 27 42">
        <ellipse style="fill: rgb(0, 0, 0); fill-opacity: 0.2;" cx="12" cy="36" rx="8" ry="4"/>
        <path d="M12.25.25a12.254 12.254 0 0 0-12 12.494c0 6.444 6.488 12.109 11.059 22.564.549 1.256 1.333 1.256 1.882 0
                 C17.762 24.853 24.25 19.186 24.25 12.744A12.254 12.254 0 0 0 12.25.25Z"
              style="fill:{color};stroke:{secondaryColor};stroke-width:1"/>
        <circle cx="12.5" cy="12.5" r="9" fill="{secondaryColor}"/>
        <text x="12" y="17.5" style="font-size:14px;fill:#000;text-anchor:middle">{text}</text>
    </svg>`

    const markerSmallCircle = `<svg xmlns="http://www.w3.org/2000/svg" width="calc(28 * {scale})" height="calc(39 * {scale})" viewBox="-1 -1 27 42">
        <ellipse style="fill: rgb(0, 0, 0); fill-opacity: 0.2;" cx="12" cy="36" rx="8" ry="4"/>
        <path d="M12.25.25a12.254 12.254 0 0 0-12 12.494c0 6.444 6.488 12.109 11.059 22.564.549 1.256 1.333 1.256 1.882 0
                 C17.762 24.853 24.25 19.186 24.25 12.744A12.254 12.254 0 0 0 12.25.25Z"
              style="fill:{color};stroke:{secondaryColor};stroke-width:1"/>
        <circle cx="12.5" cy="12.5" r="5" fill="{secondaryColor}"/>
    </svg>`

    SvgTemplateManager.addTemplate('marker-large-circle', markerLargeCircle, false)
    SvgTemplateManager.addTemplate('marker-small-circle', markerSmallCircle, false)

    const svgManager = new SvgManager(map)
    await svgManager.createFromTemplate(CLUSTERED_MARKER_IMAGE_ID, 'marker-large-circle', '#EE5900', '#fff')
    await svgManager.createFromTemplate(UNCLUSTERED_MARKER_IMAGE_ID, 'marker-small-circle', '#005974', '#fff')
}

//==============================================================================

function zoomCountText(maxZoom: number)
{
    const expr: any[] = ['step', ['zoom']]
    for (let z = 0; z <= maxZoom; z += 1) {
        if (z > 0) {
            expr.push(z)
        }
        expr.push(['to-string', ['at', z, ['get', 'zoom-count']]])
    }
    return expr as DataDrivenPropertyValueSpecification<string>
}

//==============================================================================

type GeoJSONFeatureCollection = {
    type: 'FeatureCollection'
    features: GeoJSON.Feature[]
}

//==============================================================================

type MarkerPoint = {
    type: 'Feature'
    id: number
    properties: {
        'zoom-count':  number[]
        'dataset-ids': string[]
    },
    geometry: {
        type: 'Point'
        coordinates: [number, number]
    }
}

//==============================================================================

export class ClusteredAnatomicalMarkerLayer
{
    #flatmap: FlatMap
    #map: MapLibreMap
    #mapTermGraph: MapTermGraph
    #markersByDataset: Map<string, DatasetMarkerSet> = new Map()
    #maxZoom: number
    #points: GeoJSONFeatureCollection = {
       type: 'FeatureCollection',
       features: []
    }
    #ui: UserInteractions

    constructor(flatmap: FlatMap, ui: UserInteractions)
    {
        this.#ui = ui
        this.#flatmap = flatmap
        this.#map = flatmap.map
        this.#maxZoom = this.#map.getMaxZoom()
        this.#mapTermGraph = flatmap.mapTermGraph

        this.#map.addSource(ANATOMICAL_MARKERS_SOURCE, {
            type: 'geojson',
            data: this.#points
        })
        this.#map.addLayer({
            id: ANATOMICAL_MARKERS_LAYER,
            type: 'symbol',
            source: ANATOMICAL_MARKERS_SOURCE,
            filter: ['let', 'index', ['min', ['floor', ['zoom']],
                                             ['-', ['length', ['get', 'zoom-count']], 1]],
                        ['>', ['at', ['var', 'index'], ['get', 'zoom-count']], 0]
                    ],
            layout: {
                'icon-image': CLUSTERED_MARKER_IMAGE_ID,
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'icon-offset': [0, -17],
                'icon-size': 0.8,
                'text-field': zoomCountText(this.#maxZoom),
                'text-size': 10,
                'text-offset': [0, -1.93]
            }
        })

        // inspect a cluster on click
        this.#map.on('click', ANATOMICAL_MARKERS_LAYER, async (e) => {
            const features = this.#map.queryRenderedFeatures(e.point, {
                layers: [ANATOMICAL_MARKERS_LAYER]
            })
/* WIP
            const clusterId = features[0].properties.cluster_id
            const zoom = await this.#map.getSource('markers').getClusterExpansionZoom(clusterId)
            this.#map.easeTo({
                center: features[0].geometry.coordinates,
                zoom
            })
*/
        })

        this.#map.on('mouseenter', ANATOMICAL_MARKERS_LAYER, () => {
            this.#map.getCanvas().style.cursor = 'pointer'
        })

        this.#map.on('mouseleave', ANATOMICAL_MARKERS_LAYER, () => {
            this.#map.getCanvas().style.cursor = ''
        })
    }

    singleMarkerEvent(event)
    //======================
    {
console.log('cl', event.type)
        const features = this.#map.queryRenderedFeatures(event.point, {
            layers: ['single-points']
        })
        for (const feature of features) {
            const properties = feature.properties
            const position = properties.markerPosition.slice(1, -1).split(',').map(p => +p)
            this.#ui.markerEvent_(event, feature.id, position, properties.models, properties)
        }
console.log('cl handled...')
        event.originalEvent.stopPropagation()
    }



    #update()
    //=======
    {
        const termToMarkerPoints: Map<string, MarkerPoint[]> = new Map()
        for (const datasetMarkerSet of this.#markersByDataset.values()) {
            for (const datasetMarker of datasetMarkerSet.markers) {
                if (!termToMarkerPoints.has(datasetMarker.term)) {
                    const zoomCount = Array(this.#maxZoom + 1).fill(0)
                    const datasetIds = []
                    const markerPoints: MarkerPoint[] = []
                    for (const featureId of this.#flatmap.modelFeatureIds(datasetMarker.term)) {
                        const annotation = this.#flatmap.annotation(featureId)
                        if (!('markerPosition' in annotation) && !annotation.geometry.includes('Polygon')) {
                            continue;
                        }
                        const markerId = this.#ui.nextMarkerId()
                        const markerPosition = this.#ui.markerPosition(featureId, annotation)
                        markerPoints.push({
                            type: 'Feature',
                            id: markerId,
                            properties: {
                                'zoom-count':  zoomCount,
                                'dataset-ids': datasetIds
                            },
                            geometry: {
                                type: 'Point',
                                coordinates: markerPosition
                            }
                        })
                    }
                    termToMarkerPoints.set(datasetMarker.term, markerPoints)
                }
                const markerPoint = termToMarkerPoints.get(datasetMarker.term)[0]
                // We only need to update these property fields once all of the dataset's markers
                // refer to the same two variables
                const zoomCount = markerPoint.properties['zoom-count']
                for (let zoom = 0; zoom <= this.#maxZoom; zoom += 1) {
                    if (datasetMarker.minZoom <= zoom && zoom < datasetMarker.maxZoom) {
                        zoomCount[zoom] += 1
                    }
                }
                markerPoint.properties['dataset-ids'].push(datasetMarker.datasetId)
            }
        }
        this.#points.features = []
        for (const markerPoints of termToMarkerPoints.values()) {
            this.#points.features.push(...markerPoints)
        }
        const source = this.#map.getSource(ANATOMICAL_MARKERS_SOURCE) as GeoJSONSource
        source.setData(this.#points)
    }

    addDatasetMarkers(datasets: Dataset[])
    //====================================
    {
        for (const dataset of datasets) {
            this.#markersByDataset.set(dataset.id, new DatasetMarkerSet(dataset, this.#mapTermGraph))
        }
        this.#update()
    }

    clearDatasetMarkers()
    //===================
    {
        this.#markersByDataset.clear()
        this.#update()
    }

    removeDatasetMarker(datasetId: string)
    //====================================
    {
        if (this.#markersByDataset.has(datasetId)) {
            this.#markersByDataset.delete(datasetId)
        }
        this.#update()
    }
}

//==============================================================================

