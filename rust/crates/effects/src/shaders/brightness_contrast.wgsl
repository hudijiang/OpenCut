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
    let brightness = uniforms.scalars.x;
    let contrast = uniforms.scalars.y;

    var rgb = color.rgb + vec3f(brightness);
    rgb = (rgb - vec3f(0.5)) * contrast + vec3f(0.5);

    return vec4f(clamp(rgb, vec3f(0.0), vec3f(1.0)), color.a);
}
