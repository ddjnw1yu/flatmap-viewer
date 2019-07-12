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

const peg = require("pegjs");

//==============================================================================
/*
 *  Standard prefixes: https://github.com/tgbugs/pyontutils/blob/master/nifstd/scigraph/curie_map.yaml
 */
//==============================================================================

// Styling of annotation control button

const ANNOTATION_OFF_BACKGROUND = '#EEE';
const ANNOTATION_ON_BACKGROUND  = '#F44';

//==============================================================================

class AnnotationControl
{
    constructor(ui)
    {
        this._ui = ui;
        this._annotating = false;
    }

    get enabled()
    //===========
    {
        return this._annotating;
    }

    onAdd(map)
    //========
    {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl flatmap-annotation-control';
        this._container.setAttribute('style', `background-color: ${ANNOTATION_OFF_BACKGROUND};`)
        this._container.innerHTML = 'An';
        this._container.onclick = this.onClick_.bind(this);
        return this._container;
    }

    onRemove()
    //========
    {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }

    onClick_(e)
    //=========
    {
        this._annotating = !this._annotating;
        this._container.setAttribute('style',
                                     `background-color: ${this._annotating ? ANNOTATION_ON_BACKGROUND
                                                                           : ANNOTATION_OFF_BACKGROUND};`)

        this._ui.activateLayers([this._ui.currentLayer]);

        // Get key if enabling...
        // Compare md5(key) with stored value... (which could live in map's metadata...)
        // And then only add control if metadata has an annotation key...
    }
}

//==============================================================================

export class Annotator
{
	constructor(flatmap, ui)
	{
		this._flatmap = flatmap;
		this._map = flatmap.map;
		this._annotationControl = new AnnotationControl(ui);
        this._map.addControl(this._annotationControl);
	}

    get enabled()
    //===========
    {
        return this._annotationControl.enabled;
    }

    showDialog(featureId, callback)
    //=============================
    {
    	let annotation = this._flatmap.annotationAbout(featureId);
    	if (annotation !== null) {
    	  	if (annotation.layer != this._flatmap.activeLayerId) {
    			console.log(`Annotation layer (${annotation.layer}) didn't match active layer (${
    				this._flatmap.activeLayerId} for '${featureId}'`);
    			annotation.layer = this._flatmap.activeLayerId;
    		}
    	} else {
    		annotation = { layer: this._flatmap.activeLayerId, annotation: '' };
    	}
    	this._currentFeature = featureId;
    	this._currentAnnotation = Object.assign({}, annotation);

    	this._annotationFieldId = `annotate-${featureId}`;
        this._dialogCallback = callback;
    	this._dialog = document.createElement('dialog');
    	this._dialog.innerHTML = `<form method="dialog" class="flatmap-annotation">
    <div>
		<label for="${this._annotationFieldId}">Annotate '${featureId}':</label>
		<input type="text" id="${this._annotationFieldId}" class="flatmap-annotation-input" name="${featureId}" value="${annotation.annotation}"></input>
    </div>
	<div class='flatmap-buttons'>
		<span><input type="submit" value="Save"></span>
		<span><input type="submit" autofocus value="Cancel"></span>
	</div>
</form>`;
        this._dialog.addEventListener('close', this.dialogClose_.bind(this));
        this._map.getContainer().appendChild(this._dialog);
        this._dialog.showModal();
        }

    dialogClose_(e)
    //=============
    {
        if (this._dialog.returnValue == 'Save') {
        	const annotationField = document.getElementById(this._annotationFieldId);
        	if (annotationField) {
        		if (this._currentAnnotation.annotation !== annotationField.value) {
        			this._currentAnnotation.annotation = annotationField.value;
        			this._flatmap.setAnnotationAbout(this._currentFeature, this._currentAnnotation);
        		}
        	}
        }
        this._map.getContainer().removeChild(this._dialog);
        this._dialog = null;
        this._dialogCallback();
    }
}

//==============================================================================

const GRAMMER = `
    ANNOTATION
        = FEATURE_ID (_ SPECIFICATION)*

    SPECIFICATION
        = FEATURE_CLASS
        / PROPERTY_SPEC

    // Feature classes

    FEATURE_CLASS
        = NODE_SPEC
        / EDGE_SPEC

    NODE_SPEC = 'node' _ '(' _ NEURAL_NODE _ ')'

    NEURAL_NODE
        = 'N1'
        / 'N2'
        / 'N3'
        / 'N4'
        / 'N5'

    // Need to check at least two IDs in edge
    // and that they are nodes...

    EDGE_SPEC = 'edge' _ '(' _ FEATURE_ID_LIST _ ')'

    // Properties

    PROPERTY_SPEC
        = MODELS_SPEC
        / ROUTING_SPEC

    MODELS_SPEC
        = 'models' _ '(' _ ONTOLOGY_ID_LIST _ ')'

    ROUTING_SPEC
        = ROUTING _ '(' _ FEATURE_ID _ ')'

    ROUTING
        = 'source'
        / 'target'
        / 'via'

    // Identifiers

    ONTOLOGY_ID_LIST
        = ONTOLOGY_ID _ ( ',' _ ONTOLOGY_ID ) *

    ONTOLOGY_ID
        = ontology_id:(ONTOLOGY_SUFFIX + ':' + IDENTIFIER)
        { return ontology_id.join(''); }

    ONTOLOGY_SUFFIX
        = 'FMA'
        / 'ILX'
        / 'UBERON'

    FEATURE_ID_LIST
        = FEATURE_ID _ ( ',' _ FEATURE_ID ) *

    FEATURE_ID
        = feature_id:('#' IDENTIFIER) { return feature_id.join('') }

    IDENTIFIER =
        start:START_ID
        rest:(START_ID / [./:\\-_])*
        { return start + rest.join(''); }

    START_ID =
        ([a-z] / [A-Z] / [0-9])

    // Whitespace

    _ "whitespace"
        = [ \t]* { return '' }
    `;

//==============================================================================

class Parser
{
    constructor()
    {
        this._parser = peg.generate(GRAMMER);
    }

    parseAnnotation(text)
    //===================
    {
        const result = {
            text: text
        };
        try {
            const parsed = this._parser.parse(text);
            result['id'] = parsed[0];
            const properties = {};
            for (const spec of parsed[1]) {
                const property = spec[1][0];
                const params = spec[1][4];
                let parameters = [];
                if (property in properties) {
                    parameters = properties[property];
                } else {
                    properties[property] = parameters;
                }
                if (typeof params === 'string') {
                    parameters.push(params);
                } else {
                    parameters.push(params[0]);
                    for (const param of params[2]) {
                        parameters.push(param[2]);
                    }
                }
            result['properties'] = properties;
            }
        } catch(error) {
            if (error.name === 'SyntaxError') {
                result['error'] = error.message;
            } else {
                throw error;
            }
        }
    return result;
    }
}

export const parser = new Parser;

//==============================================================================