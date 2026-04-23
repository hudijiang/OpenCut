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
    // Intensity in pixels, normalised to UV space
    let intensity = uniforms.scalars.x;
    let offset = vec2f(intensity, 0.0) / uniforms.resolution;

    let r = textureSample(input_texture, input_sampler, input.tex_coord - offset).r;
    let g = textureSample(input_texture, input_sampler, input.tex_coord).g;
    let b = textureSample(input_texture, input_sampler, input.tex_coord + offset).b;
    let a = textureSample(input_texture, input_sampler, input.tex_coord).a;

    return vec4f(r, g, b, a);
}
