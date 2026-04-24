use bridge::export;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use uuid::Uuid;

#[cfg_attr(feature = "wasm", derive(tsify_next::Tsify))]
#[cfg_attr(feature = "wasm", tsify(from_wasm_abi, into_wasm_abi))]
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct InstantiateProjectTemplateCoreOptions {
    pub scenes_json: String,
    pub current_scene_id: String,
    pub media_slots_json: String,
    pub resolved_slot_media_types_json: String,
    pub replacements_json: String,
}

#[cfg_attr(feature = "wasm", derive(tsify_next::Tsify))]
#[cfg_attr(feature = "wasm", tsify(from_wasm_abi, into_wasm_abi))]
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct InstantiateProjectTemplateCoreResult {
    pub scenes_json: String,
    pub current_scene_id: String,
}

#[cfg_attr(feature = "wasm", derive(tsify_next::Tsify))]
#[cfg_attr(feature = "wasm", tsify(from_wasm_abi, into_wasm_abi))]
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct InstantiateSceneTemplateCoreOptions {
    pub scene_json: String,
    pub media_slots_json: String,
    pub resolved_slot_media_types_json: String,
    pub replacements_json: String,
}

#[cfg_attr(feature = "wasm", derive(tsify_next::Tsify))]
#[cfg_attr(feature = "wasm", tsify(from_wasm_abi, into_wasm_abi))]
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct InstantiateSceneTemplateCoreResult {
    pub scene_json: String,
}

#[cfg_attr(feature = "wasm", derive(tsify_next::Tsify))]
#[cfg_attr(feature = "wasm", tsify(from_wasm_abi, into_wasm_abi))]
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ReplaceSlotAssetInScenesCoreOptions {
    pub scenes_json: String,
    pub current_asset_id: String,
    pub next_asset_id: String,
    pub next_media_type: String,
    pub source_duration: Option<i64>,
}

#[cfg_attr(feature = "wasm", derive(tsify_next::Tsify))]
#[cfg_attr(feature = "wasm", tsify(from_wasm_abi, into_wasm_abi))]
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ReplaceSlotAssetInScenesCoreResult {
    pub scenes_json: String,
}

#[cfg_attr(feature = "wasm", derive(tsify_next::Tsify))]
#[cfg_attr(feature = "wasm", tsify(from_wasm_abi, into_wasm_abi))]
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ValidateTemplateSchemaOptions {
    pub template_json: String,
}

#[cfg_attr(feature = "wasm", derive(tsify_next::Tsify))]
#[cfg_attr(feature = "wasm", tsify(from_wasm_abi, into_wasm_abi))]
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ValidateTemplateSchemaResult {
    pub template_json: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct TemplateBoundElementRef {
    scene_id: String,
    track_id: String,
    element_id: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct TemplateMediaSlot {
    id: String,
    bound_elements: Vec<TemplateBoundElementRef>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct SlotMediaTypeEntry {
    slot_id: String,
    media_type: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct ReplacementEntry {
    from: String,
    to: String,
}

#[export]
pub fn instantiate_project_template_core(
    InstantiateProjectTemplateCoreOptions {
        scenes_json,
        current_scene_id,
        media_slots_json,
        resolved_slot_media_types_json,
        replacements_json,
    }: InstantiateProjectTemplateCoreOptions,
) -> Result<InstantiateProjectTemplateCoreResult, String> {
    let mut scenes = parse_json::<Vec<Value>>(&scenes_json)?;
    let media_slots = parse_json::<Vec<TemplateMediaSlot>>(&media_slots_json)?;
    let resolved_slot_media_types =
        parse_json::<Vec<SlotMediaTypeEntry>>(&resolved_slot_media_types_json)?;
    let replacements = parse_json::<Vec<ReplacementEntry>>(&replacements_json)?;

    let resolved_slot_media_types = resolved_slot_media_types
        .into_iter()
        .map(|entry| (entry.slot_id, entry.media_type))
        .collect::<std::collections::HashMap<_, _>>();
    let replacements = replacements
        .into_iter()
        .map(|entry| (entry.from, entry.to))
        .collect::<std::collections::HashMap<_, _>>();

    let mut current_scene_id_map = std::collections::HashMap::new();
    for scene in &mut scenes {
        apply_resolved_slot_media_types_to_scene(scene, &media_slots, &resolved_slot_media_types)?;
        replace_media_ids_in_scene(scene, &replacements)?;
        let old_scene_id = get_string(scene, "id")?.to_owned();
        let new_scene_id = refresh_scene_ids(scene)?;
        current_scene_id_map.insert(old_scene_id, new_scene_id);
    }

    let next_current_scene_id = current_scene_id_map
        .get(&current_scene_id)
        .cloned()
        .or_else(|| scenes.first().and_then(|scene| get_string(scene, "id").ok().map(str::to_owned)))
        .unwrap_or_default();

    Ok(InstantiateProjectTemplateCoreResult {
        scenes_json: serde_json::to_string(&scenes).map_err(|error| error.to_string())?,
        current_scene_id: next_current_scene_id,
    })
}

#[export]
pub fn instantiate_scene_template_core(
    InstantiateSceneTemplateCoreOptions {
        scene_json,
        media_slots_json,
        resolved_slot_media_types_json,
        replacements_json,
    }: InstantiateSceneTemplateCoreOptions,
) -> Result<InstantiateSceneTemplateCoreResult, String> {
    let mut scene = parse_json::<Value>(&scene_json)?;
    let media_slots = parse_json::<Vec<TemplateMediaSlot>>(&media_slots_json)?;
    let resolved_slot_media_types =
        parse_json::<Vec<SlotMediaTypeEntry>>(&resolved_slot_media_types_json)?;
    let replacements = parse_json::<Vec<ReplacementEntry>>(&replacements_json)?;

    let resolved_slot_media_types = resolved_slot_media_types
        .into_iter()
        .map(|entry| (entry.slot_id, entry.media_type))
        .collect::<std::collections::HashMap<_, _>>();
    let replacements = replacements
        .into_iter()
        .map(|entry| (entry.from, entry.to))
        .collect::<std::collections::HashMap<_, _>>();

    apply_resolved_slot_media_types_to_scene(&mut scene, &media_slots, &resolved_slot_media_types)?;
    replace_media_ids_in_scene(&mut scene, &replacements)?;
    refresh_scene_ids(&mut scene)?;

    Ok(InstantiateSceneTemplateCoreResult {
        scene_json: serde_json::to_string(&scene).map_err(|error| error.to_string())?,
    })
}

#[export]
pub fn replace_slot_asset_in_scenes_core(
    ReplaceSlotAssetInScenesCoreOptions {
        scenes_json,
        current_asset_id,
        next_asset_id,
        next_media_type,
        source_duration,
    }: ReplaceSlotAssetInScenesCoreOptions,
) -> Result<ReplaceSlotAssetInScenesCoreResult, String> {
    let mut scenes = parse_json::<Vec<Value>>(&scenes_json)?;

    for scene in &mut scenes {
        update_scene_media_for_asset(
            scene,
            &current_asset_id,
            &next_asset_id,
            &next_media_type,
            source_duration,
        )?;
    }

    Ok(ReplaceSlotAssetInScenesCoreResult {
        scenes_json: serde_json::to_string(&scenes).map_err(|error| error.to_string())?,
    })
}

#[export]
pub fn validate_template_schema(
    ValidateTemplateSchemaOptions { template_json }: ValidateTemplateSchemaOptions,
) -> Result<ValidateTemplateSchemaResult, String> {
    let mut template = parse_json::<Value>(&template_json)?;
    let object = template
        .as_object_mut()
        .ok_or_else(|| "Template root must be an object".to_string())?;

    if !matches!(
        object.get("kind").and_then(Value::as_str),
        Some("project") | Some("scene")
    ) {
        return Err("Template kind must be 'project' or 'scene'".to_string());
    }

    if object.get("version").and_then(Value::as_u64).unwrap_or(0) == 0 {
        object.insert("version".to_string(), Value::from(1));
    }
    if !object.contains_key("locale") {
        object.insert("locale".to_string(), Value::from("en"));
    }
    if !object.contains_key("tags") {
        object.insert("tags".to_string(), Value::Array(Vec::new()));
    }
    if !object.contains_key("source") {
        object.insert("source".to_string(), Value::from("user"));
    }

    Ok(ValidateTemplateSchemaResult {
        template_json: serde_json::to_string(&template).map_err(|error| error.to_string())?,
    })
}

fn parse_json<TValue>(input: &str) -> Result<TValue, String>
where
    TValue: for<'de> Deserialize<'de>,
{
    serde_json::from_str(input).map_err(|error| error.to_string())
}

fn generate_id() -> String {
    Uuid::new_v4().to_string()
}

#[cfg(feature = "wasm")]
fn now_iso_string() -> String {
    js_sys::Date::new_0().to_iso_string().into()
}

#[cfg(not(feature = "wasm"))]
fn now_iso_string() -> String {
    "1970-01-01T00:00:00.000Z".to_string()
}

fn get_string<'a>(value: &'a Value, key: &str) -> Result<&'a str, String> {
    value.get(key)
        .and_then(Value::as_str)
        .ok_or_else(|| format!("Missing string field '{key}'"))
}

fn refresh_scene_ids(scene: &mut Value) -> Result<String, String> {
    let scene_object = scene
        .as_object_mut()
        .ok_or_else(|| "Scene must be an object".to_string())?;
    let next_scene_id = generate_id();
    let now_iso = now_iso_string();
    scene_object.insert("id".to_string(), Value::from(next_scene_id.clone()));
    scene_object.insert("createdAt".to_string(), Value::from(now_iso.clone()));
    scene_object.insert("updatedAt".to_string(), Value::from(now_iso));

    let tracks = scene_object
        .get_mut("tracks")
        .and_then(Value::as_object_mut)
        .ok_or_else(|| "Scene tracks must be an object".to_string())?;

    if let Some(main_track) = tracks.get_mut("main") {
        refresh_track(main_track)?;
    }
    if let Some(overlay_tracks) = tracks.get_mut("overlay").and_then(Value::as_array_mut) {
        for track in overlay_tracks {
            refresh_track(track)?;
        }
    }
    if let Some(audio_tracks) = tracks.get_mut("audio").and_then(Value::as_array_mut) {
        for track in audio_tracks {
            refresh_track(track)?;
        }
    }

    Ok(next_scene_id)
}

fn refresh_track(track: &mut Value) -> Result<(), String> {
    let track_object = track
        .as_object_mut()
        .ok_or_else(|| "Track must be an object".to_string())?;
    track_object.insert("id".to_string(), Value::from(generate_id()));

    if let Some(elements) = track_object.get_mut("elements").and_then(Value::as_array_mut) {
        for element in elements {
            refresh_element_ids(element)?;
        }
    }

    Ok(())
}

fn refresh_element_ids(element: &mut Value) -> Result<(), String> {
    let element_object = element
        .as_object_mut()
        .ok_or_else(|| "Element must be an object".to_string())?;
    element_object.insert("id".to_string(), Value::from(generate_id()));

    if let Some(effects) = element_object.get_mut("effects").and_then(Value::as_array_mut) {
        for effect in effects {
            if let Some(effect_object) = effect.as_object_mut() {
                effect_object.insert("id".to_string(), Value::from(generate_id()));
            }
        }
    }

    if let Some(masks) = element_object.get_mut("masks").and_then(Value::as_array_mut) {
        for mask in masks {
            if let Some(mask_object) = mask.as_object_mut() {
                mask_object.insert("id".to_string(), Value::from(generate_id()));
                if let Some(params) = mask_object.get_mut("params") {
                    clone_custom_mask_point_ids(params);
                }
            }
        }
    }

    if let Some(animations) = element_object
        .get_mut("animations")
        .and_then(Value::as_object_mut)
    {
        if let Some(channels) = animations.get_mut("channels").and_then(Value::as_object_mut) {
            for channel in channels.values_mut() {
                if let Some(keys) = channel.get_mut("keys").and_then(Value::as_array_mut) {
                    for key in keys {
                        if let Some(key_object) = key.as_object_mut() {
                            key_object.insert("id".to_string(), Value::from(generate_id()));
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

fn clone_custom_mask_point_ids(value: &mut Value) {
    match value {
        Value::Array(entries) => {
            for entry in entries {
                clone_custom_mask_point_ids(entry);
            }
        }
        Value::Object(object) => {
            if looks_like_mask_point(object) {
                object.insert("id".to_string(), Value::from(generate_id()));
                return;
            }

            for entry in object.values_mut() {
                clone_custom_mask_point_ids(entry);
            }
        }
        _ => {}
    }
}

fn looks_like_mask_point(object: &Map<String, Value>) -> bool {
    matches!(object.get("id"), Some(Value::String(_)))
        && object.get("x").and_then(Value::as_f64).is_some()
        && object.get("y").and_then(Value::as_f64).is_some()
        && object.get("inX").and_then(Value::as_f64).is_some()
        && object.get("inY").and_then(Value::as_f64).is_some()
        && object.get("outX").and_then(Value::as_f64).is_some()
        && object.get("outY").and_then(Value::as_f64).is_some()
}

fn apply_resolved_slot_media_types_to_scene(
    scene: &mut Value,
    media_slots: &[TemplateMediaSlot],
    resolved_slot_media_types: &std::collections::HashMap<String, String>,
) -> Result<(), String> {
    let scene_id = get_string(scene, "id")?.to_owned();

    for slot in media_slots {
        let Some(media_type) = resolved_slot_media_types.get(&slot.id) else {
            continue;
        };
        if media_type != "video" && media_type != "image" {
            continue;
        }

        for bound_element in &slot.bound_elements {
            if bound_element.scene_id != scene_id {
                continue;
            }
            let Some(track) = find_track_mut(scene, &bound_element.track_id) else {
                continue;
            };
            let Some(element) = find_element_mut(track, &bound_element.element_id) else {
                continue;
            };
            update_element_visual_type(element, media_type)?;
        }
    }

    Ok(())
}

fn replace_media_ids_in_scene(
    scene: &mut Value,
    replacements: &std::collections::HashMap<String, String>,
) -> Result<(), String> {
    visit_scene_elements_mut(scene, |element| {
        if let Some(media_id) = element.get("mediaId").and_then(Value::as_str) {
            if let Some(replacement) = replacements.get(media_id) {
                if let Some(element_object) = element.as_object_mut() {
                    element_object.insert("mediaId".to_string(), Value::from(replacement.clone()));
                }
            }
        }
        Ok(())
    })?;

    Ok(())
}

fn update_scene_media_for_asset(
    scene: &mut Value,
    current_asset_id: &str,
    next_asset_id: &str,
    next_media_type: &str,
    source_duration: Option<i64>,
) -> Result<(), String> {
    visit_scene_elements_mut(scene, |element| {
        let Some(media_id) = element.get("mediaId").and_then(Value::as_str) else {
            return Ok(());
        };
        if media_id != current_asset_id {
            return Ok(());
        }

        update_element_media_for_asset(
            element,
            next_asset_id,
            next_media_type,
            source_duration,
        )
    })?;

    Ok(())
}

fn update_element_media_for_asset(
    element: &mut Value,
    next_asset_id: &str,
    next_media_type: &str,
    source_duration: Option<i64>,
) -> Result<(), String> {
    let element_type = get_string(element, "type")?.to_owned();

    match next_media_type {
        "video" | "image" => {
            if element_type != "video" && element_type != "image" {
                return Ok(());
            }

            update_element_visual_type(element, next_media_type)?;
            let element_object = element
                .as_object_mut()
                .ok_or_else(|| "Element must be an object".to_string())?;
            element_object.insert("mediaId".to_string(), Value::from(next_asset_id));

            if next_media_type == "video" {
                if let Some(duration) = source_duration {
                    element_object.insert("sourceDuration".to_string(), Value::from(duration));
                }
            }
        }
        "audio" => {
            if element_type != "audio" {
                return Ok(());
            }

            let element_object = element
                .as_object_mut()
                .ok_or_else(|| "Element must be an object".to_string())?;
            element_object.insert("mediaId".to_string(), Value::from(next_asset_id));
            if let Some(duration) = source_duration {
                element_object.insert("sourceDuration".to_string(), Value::from(duration));
            }
        }
        _ => {}
    }

    Ok(())
}

fn update_element_visual_type(element: &mut Value, media_type: &str) -> Result<(), String> {
    let current_type = get_string(element, "type")?.to_owned();
    let element_object = element
        .as_object_mut()
        .ok_or_else(|| "Element must be an object".to_string())?;

    if current_type != "video" && current_type != "image" {
        return Ok(());
    }
    if current_type == media_type {
        return Ok(());
    }

    element_object.insert("type".to_string(), Value::from(media_type));

    if media_type == "image" {
        element_object.remove("volume");
        element_object.remove("muted");
        element_object.remove("isSourceAudioEnabled");
        element_object.remove("retime");
        return Ok(());
    }

    if !element_object.contains_key("volume") {
        element_object.insert("volume".to_string(), Value::from(1.0));
    }
    if !element_object.contains_key("muted") {
        element_object.insert("muted".to_string(), Value::from(false));
    }
    if !element_object.contains_key("isSourceAudioEnabled") {
        element_object.insert("isSourceAudioEnabled".to_string(), Value::from(true));
    }

    Ok(())
}

fn find_track_mut<'a>(scene: &'a mut Value, track_id: &str) -> Option<&'a mut Value> {
    let tracks = scene.get_mut("tracks")?.as_object_mut()?;

    if tracks
        .get("main")
        .and_then(|track| track.get("id"))
        .and_then(Value::as_str)
        == Some(track_id)
    {
        return tracks.get_mut("main");
    }

    if let Some(overlay_tracks) = tracks.get_mut("overlay").and_then(Value::as_array_mut) {
        if let Some(index) = overlay_tracks.iter().position(|track| {
            track
                .get("id")
                .and_then(Value::as_str)
                .map(|id| id == track_id)
                .unwrap_or(false)
        }) {
            return overlay_tracks.get_mut(index);
        }
    }

    if let Some(audio_tracks) = tracks.get_mut("audio").and_then(Value::as_array_mut) {
        if let Some(index) = audio_tracks.iter().position(|track| {
            track
                .get("id")
                .and_then(Value::as_str)
                .map(|id| id == track_id)
                .unwrap_or(false)
        }) {
            return audio_tracks.get_mut(index);
        }
    }

    None
}

fn find_element_mut<'a>(track: &'a mut Value, element_id: &str) -> Option<&'a mut Value> {
    let elements = track.get_mut("elements")?.as_array_mut()?;
    let index = elements.iter().position(|element| {
        element
            .get("id")
            .and_then(Value::as_str)
            .map(|id| id == element_id)
            .unwrap_or(false)
    })?;
    elements.get_mut(index)
}

fn visit_scene_elements_mut<F>(scene: &mut Value, mut visitor: F) -> Result<(), String>
where
    F: FnMut(&mut Value) -> Result<(), String>,
{
    let tracks = scene
        .get_mut("tracks")
        .and_then(Value::as_object_mut)
        .ok_or_else(|| "Scene tracks must be an object".to_string())?;

    if let Some(main_track) = tracks.get_mut("main") {
        visit_track_elements_mut(main_track, &mut visitor)?;
    }
    if let Some(overlay_tracks) = tracks.get_mut("overlay").and_then(Value::as_array_mut) {
        for track in overlay_tracks {
            visit_track_elements_mut(track, &mut visitor)?;
        }
    }
    if let Some(audio_tracks) = tracks.get_mut("audio").and_then(Value::as_array_mut) {
        for track in audio_tracks {
            visit_track_elements_mut(track, &mut visitor)?;
        }
    }

    Ok(())
}

fn visit_track_elements_mut<F>(track: &mut Value, visitor: &mut F) -> Result<(), String>
where
    F: FnMut(&mut Value) -> Result<(), String>,
{
    if let Some(elements) = track.get_mut("elements").and_then(Value::as_array_mut) {
        for element in elements {
            visitor(element)?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        instantiate_project_template_core, replace_slot_asset_in_scenes_core,
        InstantiateProjectTemplateCoreOptions, ReplaceSlotAssetInScenesCoreOptions,
    };
    use serde_json::json;

    #[test]
    fn refreshes_ids_and_replaces_media_ids_for_project_templates() {
        let scene = json!({
            "id": "scene-1",
            "name": "Scene",
            "isMain": true,
            "bookmarks": [],
            "createdAt": "2026-04-24T00:00:00.000Z",
            "updatedAt": "2026-04-24T00:00:00.000Z",
            "tracks": {
                "overlay": [],
                "main": {
                    "id": "track-1",
                    "name": "Main",
                    "type": "video",
                    "muted": false,
                    "hidden": false,
                    "elements": [{
                        "id": "element-1",
                        "type": "image",
                        "name": "Hero",
                        "mediaId": "slot-hero",
                        "duration": 720000,
                        "startTime": 0,
                        "trimStart": 0,
                        "trimEnd": 0,
                        "sourceDuration": 720000,
                        "transform": {
                            "scaleX": 1.0,
                            "scaleY": 1.0,
                            "position": { "x": 0, "y": 0 },
                            "rotate": 0
                        },
                        "opacity": 1,
                        "hidden": false
                    }]
                },
                "audio": []
            }
        });

        let result = instantiate_project_template_core(InstantiateProjectTemplateCoreOptions {
            scenes_json: serde_json::to_string(&vec![scene]).unwrap(),
            current_scene_id: "scene-1".to_string(),
            media_slots_json: serde_json::to_string(&vec![json!({
                "id": "slot-hero",
                "boundElements": [{
                    "sceneId": "scene-1",
                    "trackId": "track-1",
                    "elementId": "element-1"
                }]
            })])
            .unwrap(),
            resolved_slot_media_types_json: serde_json::to_string(&vec![json!({
                "slotId": "slot-hero",
                "mediaType": "video"
            })])
            .unwrap(),
            replacements_json: serde_json::to_string(&vec![json!({
                "from": "slot-hero",
                "to": "asset-hero"
            })])
            .unwrap(),
        })
        .unwrap();

        let scenes: Vec<Value> = serde_json::from_str(&result.scenes_json).unwrap();
        let scene = &scenes[0];
        let element = &scene["tracks"]["main"]["elements"][0];

        assert_ne!(scene["id"], "scene-1");
        assert_eq!(element["type"], "video");
        assert_eq!(element["mediaId"], "asset-hero");
        assert_eq!(result.current_scene_id, scene["id"].as_str().unwrap());
    }

    #[test]
    fn replaces_only_targeted_slot_assets() {
        let scenes = vec![json!({
            "id": "scene-1",
            "name": "Scene",
            "isMain": true,
            "bookmarks": [],
            "createdAt": "2026-04-24T00:00:00.000Z",
            "updatedAt": "2026-04-24T00:00:00.000Z",
            "tracks": {
                "overlay": [],
                "main": {
                    "id": "track-1",
                    "name": "Main",
                    "type": "video",
                    "muted": false,
                    "hidden": false,
                    "elements": [{
                        "id": "element-1",
                        "type": "image",
                        "name": "Hero",
                        "mediaId": "asset-hero",
                        "duration": 720000,
                        "startTime": 0,
                        "trimStart": 0,
                        "trimEnd": 0,
                        "sourceDuration": 720000,
                        "transform": {
                            "scaleX": 1.0,
                            "scaleY": 1.0,
                            "position": { "x": 0, "y": 0 },
                            "rotate": 0
                        },
                        "opacity": 1,
                        "hidden": false
                    }]
                },
                "audio": []
            }
        })];

        let result = replace_slot_asset_in_scenes_core(ReplaceSlotAssetInScenesCoreOptions {
            scenes_json: serde_json::to_string(&scenes).unwrap(),
            current_asset_id: "asset-hero".to_string(),
            next_asset_id: "asset-video".to_string(),
            next_media_type: "video".to_string(),
            source_duration: Some(1_200_000),
        })
        .unwrap();

        let scenes: Vec<Value> = serde_json::from_str(&result.scenes_json).unwrap();
        let element = &scenes[0]["tracks"]["main"]["elements"][0];
        assert_eq!(element["type"], "video");
        assert_eq!(element["mediaId"], "asset-video");
        assert_eq!(element["sourceDuration"], 1_200_000);
    }
}
