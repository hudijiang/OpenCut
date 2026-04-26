struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) tex_coord: vec2f,
}

struct EffectUniforms {
    resolution: vec2f,
    direction: vec2f,
    scalars: vec4f,
}

@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var input_sampler: sampler;
@group(1) @binding(0) var<uniform> uniforms: EffectUniforms;

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let color = textureSample(input_texture, input_sampler, input.tex_coord);
    let key_color = vec3f(uniforms.direction.x, uniforms.direction.y, uniforms.scalars.w);
    let threshold = uniforms.scalars.x;
    let softness = max(uniforms.scalars.y, 0.0001);
    let spill = uniforms.scalars.z;

    let distance_to_key = distance(color.rgb, key_color);
    let alpha = smoothstep(threshold, threshold + softness, distance_to_key) * color.a;
    let green_spill = max(color.g - max(color.r, color.b), 0.0) * spill;
    let rgb = vec3f(color.r + green_spill * 0.25, color.g - green_spill, color.b + green_spill * 0.25);

    return vec4f(clamp(rgb, vec3f(0.0), vec3f(1.0)), alpha);
}
