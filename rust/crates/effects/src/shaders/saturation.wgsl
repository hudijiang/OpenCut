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

fn rotate_hue(rgb: vec3f, angle: f32) -> vec3f {
    let c = cos(angle);
    let s = sin(angle);
    let weights = vec3f(0.299, 0.587, 0.114);

    return vec3f(
        rgb.r * (weights.r + c * (1.0 - weights.r) + s * (-weights.r)) +
            rgb.g * (weights.g + c * (-weights.g) + s * (-weights.g)) +
            rgb.b * (weights.b + c * (-weights.b) + s * (1.0 - weights.b)),
        rgb.r * (weights.r + c * (-weights.r) + s * 0.143) +
            rgb.g * (weights.g + c * (1.0 - weights.g) + s * 0.140) +
            rgb.b * (weights.b + c * (-weights.b) + s * -0.283),
        rgb.r * (weights.r + c * (-weights.r) + s * (-(1.0 - weights.r))) +
            rgb.g * (weights.g + c * (-weights.g) + s * weights.g) +
            rgb.b * (weights.b + c * (1.0 - weights.b) + s * weights.b)
    );
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let color = textureSample(input_texture, input_sampler, input.tex_coord);
    let saturation = uniforms.scalars.x;
    let hue = uniforms.scalars.y;
    let luminance = dot(color.rgb, vec3f(0.299, 0.587, 0.114));

    var rgb = mix(vec3f(luminance), color.rgb, saturation);
    rgb = rotate_hue(rgb, hue);

    return vec4f(clamp(rgb, vec3f(0.0), vec3f(1.0)), color.a);
}
