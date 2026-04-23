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

fn hash(p: vec2f) -> f32 {
    let q = vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)));
    return fract(sin(dot(q, vec2f(1.0, 1.0))) * 43758.5453);
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let color = textureSample(input_texture, input_sampler, input.tex_coord);
    let intensity = uniforms.scalars.x;
    let seed = uniforms.scalars.y;

    // Pixel coordinate + seed drives per-frame noise variation
    let pixel = input.tex_coord * uniforms.resolution;
    let noise = hash(pixel + vec2f(seed, seed * 1.3));

    // Center noise around 0 and scale by intensity
    let grain = (noise - 0.5) * intensity;

    return vec4f(clamp(color.rgb + grain, vec3f(0.0), vec3f(1.0)), color.a);
}
