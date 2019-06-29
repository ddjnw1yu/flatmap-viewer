/******************************************************************************

Flatmap viewer and annotation tool

Copyright (c) 2019  David Brooks

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

******************************************************************************/

'use strict';

//==============================================================================

import mapboxgl from 'mapbox-gl';

//==============================================================================

function valueToString(value)
//===========================
{
    if (typeof value === 'undefined' || value === null){
        return value;
    } else if (value instanceof Date) {
        return value.toLocaleString();
    } else if (typeof value === 'object'
            || typeof value === 'number'
            || typeof value === 'string') {
        return value.toString();
    } else {
        return value;
    }
}

function describeProperty(name, value)
//====================================
{
    return `<div class="features-property">
  <div class="features-property-value">${valueToString(value)}</div>
</div>`;
}

function describeFeature(feature)
//===============================
{
    const html = [];
    for (const [name, value] of Object.entries(feature.properties)) {
        html.push(describeProperty(name, value));
    }
    return html.join('\n');
}

//==============================================================================

export class ToolTip
{
    constructor(flatmap)
    {
        this._flatmap = flatmap;
        this._map = flatmap.map;
        this._popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false
        });
    }

    hide()
    //====
    {
        this._popup.remove();
    }

    show(feature, position)
    //=====================
    {
        this._popup.setLngLat(position);
        this._popup.setHTML(`<div class="features-tooltip">${describeFeature(feature)}</div>`);
        this._popup.addTo(this._map);
    }
}

//==============================================================================
