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
    let temperature = uniforms.scalars.x;
    let tint = uniforms.scalars.y;

    let temperature_shift = vec3f(temperature, 0.0, -temperature);
    let tint_shift = vec3f(tint * 0.5, -abs(tint) * 0.25, tint * -0.5);
    let rgb = color.rgb + temperature_shift + tint_shift;

    return vec4f(clamp(rgb, vec3f(0.0), vec3f(1.0)), color.a);
}
