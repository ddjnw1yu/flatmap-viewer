/*==============================================================================

Flatmap viewer and annotation tool

Copyright (c) 2019 - 2023  David Brooks

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

const FC_KIND = {
    SYSTEM: ['fc:System', 'fc-class:System'],
    ORGAN:  ['fc:Organ', 'fc-class:Organ'],
    FTU:    ['fc:Ftu', 'fc-class:Ftu']
};

//==============================================================================

export class SystemsManager
{
    constructor(flatmap, ui, enabled=false)
    {
        this.__flatmap = flatmap;
        this.__ui = ui;
        this.__systems = new Map();
        this.__enabledChildren = new Map();
        for (const [_, ann] of flatmap.annotations) {
            if (FC_KIND.SYSTEM.includes(ann['fc-class'])) {
                const systemId = ann.name.replaceAll(' ', '_');
                if (this.__systems.has(systemId)) {
                    this.__systems.get(systemId).featureIds.push(ann.featureId)
                } else {
                    this.__systems.set(systemId, {
                        name: ann.name,
                        colour: ann.colour,
                        featureIds: [ ann.featureId ],
                        enabled: false,
                        pathIds: ('path-ids' in ann) ? ann['path-ids'] : [],
                        organs: this.__children(ann.children, FC_KIND.ORGAN)
                    });
                this.__ui.enableFeature(ann.featureId, false, true);
                }
                for (const childId of ann['children']) {
                    this.__enabledChildren.set(childId, 0);
                    this.__ui.enableFeatureWithChildren(childId, false, true);
                }
            }
        }
        for (const system of this.__systems.values()) {
            if (enabled) {
                this.__enableSystem(system, true);
            } else {
                // Disable all paths associated with the disabled system
                this.__ui.enablePathsBySystem(system, false, true);
            }
        }
    }

    __children(childFeatureIds, childClass)
    //=====================================
    {
        const children = [];
        for (const childFeatureId of childFeatureIds || []) {
            const childAnnotation = this.__flatmap.annotation(childFeatureId);
            if (childAnnotation !== undefined && childClass.includes(childAnnotation['fc-class'])) {
                const child = {
                    label: childAnnotation.label,
                    models: childAnnotation.models
                };
                if (childClass === FC_KIND.ORGAN) {
                    child.ftus = this.__children(childAnnotation.children, FC_KIND.FTU)
                };
                children.push(child);
            }
        }
        return children;
    }

    get systems()
    //===========
    {
        const systems = [];
        for (const [systemId, system] of this.__systems.entries()) {
            systems.push({
                id: systemId,
                name: system.name,
                colour: system.colour,
                enabled: system.enabled,
                organs: system.organs
            });
        }
        return systems;
    }

    enable(systemId, enable=true)
    //===========================
    {
        const system = this.__systems.get(systemId);
        if (system !== undefined && enable !== system.enabled) {
            this.__enableSystem(system, enable);
        }
    }

    __enableSystem(system, enable=true)
    //=================================
    {
        for (const featureId of system.featureIds) {
            const feature = this.__ui.mapFeature(featureId);
            if (feature !== undefined) {
                this.__ui.enableMapFeature(feature, enable);
                for (const childFeatureId of feature.children) {
                    const enabledCount = this.__enabledChildren.get(childFeatureId);
                    if (enable && enabledCount === 0 || !enable && enabledCount == 1) {
                        this.__ui.enableFeatureWithChildren(childFeatureId, enable);
                    }
                    this.__enabledChildren.set(childFeatureId, enabledCount + (enable ? 1 : -1));
                }
            }
        }

        // Enable/disable all paths associated with the system
        this.__ui.enablePathsBySystem(system, enable);

        // Save system state
        system.enabled = enable;
    }

    systemEnabled(systemId)
    //=====================
    {
        const system = this.__systems.get(systemId);
        return (system !== undefined && system.enabled);
    }
}

//==============================================================================
