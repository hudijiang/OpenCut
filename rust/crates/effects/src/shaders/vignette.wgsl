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
    let intensity = uniforms.scalars.x;
    let softness = uniforms.scalars.y;

    // Distance from center in [0, 1] space
    let uv = input.tex_coord * 2.0 - 1.0;
    let aspect = uniforms.resolution.x / uniforms.resolution.y;
    var vignette_uv = uv;
    if (aspect >= 1.0) {
        vignette_uv.x = vignette_uv.x * aspect;
    } else {
        vignette_uv.y = vignette_uv.y / aspect;
    }
    let d = length(vignette_uv);

    // Smooth vignette using smoothstep between (1-softness) and 1
    var vignette = 1.0;
    if (softness <= 0.0) {
        vignette = 1.0 - select(0.0, intensity, d >= 1.0);
    } else {
        let inner = 1.0 - max(softness, 1e-6);
        vignette = 1.0 - smoothstep(inner, 1.0, d) * intensity;
    }

    return vec4f(color.rgb * vignette, color.a);
}
