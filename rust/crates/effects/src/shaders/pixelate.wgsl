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
    let block_size = max(uniforms.scalars.x, 1.0);
    let pixel = input.tex_coord * uniforms.resolution;
    let snapped = (floor(pixel / block_size) + vec2f(0.5)) * block_size;
    let uv = clamp(snapped / uniforms.resolution, vec2f(0.0), vec2f(1.0));

    return textureSample(input_texture, input_sampler, uv);
}
