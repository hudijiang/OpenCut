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

fn apply_curve(value: f32, lift: f32, gamma: f32, gain: f32) -> f32 {
    let lifted = clamp(value + lift, 0.0, 1.0);
    let curved = pow(lifted, 1.0 / max(gamma, 0.01));
    return clamp(curved * gain, 0.0, 1.0);
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let color = textureSample(input_texture, input_sampler, input.tex_coord);
    let lift = uniforms.scalars.x;
    let gamma = uniforms.scalars.y;
    let gain = uniforms.scalars.z;
    let mix_amount = uniforms.scalars.w;

    let graded = vec3f(
        apply_curve(color.r, lift, gamma, gain),
        apply_curve(color.g, lift, gamma, gain),
        apply_curve(color.b, lift, gamma, gain)
    );

    return vec4f(mix(color.rgb, graded, mix_amount), color.a);
}
