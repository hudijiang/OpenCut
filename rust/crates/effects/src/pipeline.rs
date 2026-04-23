use std::collections::HashMap;

use bytemuck::{Pod, Zeroable};
use gpu::{FULLSCREEN_SHADER_SOURCE, GpuContext};
use thiserror::Error;
use wgpu::util::DeviceExt;

use crate::{EffectPass, UniformValue};

const GAUSSIAN_BLUR_SHADER_ID: &str = "gaussian-blur";
const GAUSSIAN_BLUR_SHADER_SOURCE: &str = include_str!("shaders/gaussian_blur.wgsl");

const VIGNETTE_SHADER_ID: &str = "vignette";
const VIGNETTE_SHADER_SOURCE: &str = include_str!("shaders/vignette.wgsl");

const FILM_GRAIN_SHADER_ID: &str = "film-grain";
const FILM_GRAIN_SHADER_SOURCE: &str = include_str!("shaders/film_grain.wgsl");

const SHARPEN_SHADER_ID: &str = "sharpen";
const SHARPEN_SHADER_SOURCE: &str = include_str!("shaders/sharpen.wgsl");

const CHROMATIC_ABERRATION_SHADER_ID: &str = "chromatic-aberration";
const CHROMATIC_ABERRATION_SHADER_SOURCE: &str = include_str!("shaders/chromatic_aberration.wgsl");

pub struct ApplyEffectsOptions<'a> {
    pub source: &'a wgpu::Texture,
    pub width: u32,
    pub height: u32,
    pub passes: &'a [EffectPass],
}

pub struct EffectPipeline {
    uniform_bind_group_layout: wgpu::BindGroupLayout,
    pipelines: HashMap<String, wgpu::RenderPipeline>,
}

#[derive(Debug, Error)]
pub enum EffectsError {
    #[error("At least one effect pass is required")]
    MissingEffectPasses,
    #[error("Unknown effect shader '{shader}'")]
    UnknownEffectShader { shader: String },
    #[error("Missing uniform '{uniform}' for shader '{shader}'")]
    MissingUniform { shader: String, uniform: String },
    #[error("Uniform '{uniform}' for shader '{shader}' must be a number")]
    InvalidNumberUniform { shader: String, uniform: String },
    #[error(
        "Uniform '{uniform}' for shader '{shader}' must be a vector of length {expected_length}"
    )]
    InvalidVectorUniform {
        shader: String,
        uniform: String,
        expected_length: usize,
    },
    #[error("Shader '{shader}' does not support uniform '{uniform}'")]
    UnsupportedUniform { shader: String, uniform: String },
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct EffectUniformBuffer {
    resolution: [f32; 2],
    direction: [f32; 2],
    scalars: [f32; 4],
}

impl EffectPipeline {
    pub fn new(context: &GpuContext) -> Self {
        let uniform_bind_group_layout =
            context
                .device()
                .create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                    label: Some("effects-uniform-bind-group-layout"),
                    entries: &[wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Buffer {
                            ty: wgpu::BufferBindingType::Uniform,
                            has_dynamic_offset: false,
                            min_binding_size: None,
                        },
                        count: None,
                    }],
                });
        let vertex_shader_module =
            context
                .device()
                .create_shader_module(wgpu::ShaderModuleDescriptor {
                    label: Some("effects-fullscreen-shader"),
                    source: wgpu::ShaderSource::Wgsl(FULLSCREEN_SHADER_SOURCE.into()),
                });
        let gaussian_blur_shader_module =
            context
                .device()
                .create_shader_module(wgpu::ShaderModuleDescriptor {
                    label: Some("effects-gaussian-blur-shader"),
                    source: wgpu::ShaderSource::Wgsl(GAUSSIAN_BLUR_SHADER_SOURCE.into()),
                });
        let vignette_shader_module =
            context
                .device()
                .create_shader_module(wgpu::ShaderModuleDescriptor {
                    label: Some("effects-vignette-shader"),
                    source: wgpu::ShaderSource::Wgsl(VIGNETTE_SHADER_SOURCE.into()),
                });
        let film_grain_shader_module =
            context
                .device()
                .create_shader_module(wgpu::ShaderModuleDescriptor {
                    label: Some("effects-film-grain-shader"),
                    source: wgpu::ShaderSource::Wgsl(FILM_GRAIN_SHADER_SOURCE.into()),
                });
        let sharpen_shader_module =
            context
                .device()
                .create_shader_module(wgpu::ShaderModuleDescriptor {
                    label: Some("effects-sharpen-shader"),
                    source: wgpu::ShaderSource::Wgsl(SHARPEN_SHADER_SOURCE.into()),
                });
        let chromatic_aberration_shader_module =
            context
                .device()
                .create_shader_module(wgpu::ShaderModuleDescriptor {
                    label: Some("effects-chromatic-aberration-shader"),
                    source: wgpu::ShaderSource::Wgsl(CHROMATIC_ABERRATION_SHADER_SOURCE.into()),
                });
        let pipeline_layout =
            context
                .device()
                .create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                    label: Some("effects-pipeline-layout"),
                    bind_group_layouts: &[
                        Some(context.texture_sampler_bind_group_layout()),
                        Some(&uniform_bind_group_layout),
                    ],
                    immediate_size: 0,
                });

        let make_pipeline = |label: &'static str, shader_module: &wgpu::ShaderModule| {
            context
                .device()
                .create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                    label: Some(label),
                    layout: Some(&pipeline_layout),
                    vertex: wgpu::VertexState {
                        module: &vertex_shader_module,
                        entry_point: Some("vertex_main"),
                        buffers: &[wgpu::VertexBufferLayout {
                            array_stride: std::mem::size_of::<[f32; 2]>() as u64,
                            step_mode: wgpu::VertexStepMode::Vertex,
                            attributes: &[wgpu::VertexAttribute {
                                format: wgpu::VertexFormat::Float32x2,
                                offset: 0,
                                shader_location: 0,
                            }],
                        }],
                        compilation_options: wgpu::PipelineCompilationOptions::default(),
                    },
                    fragment: Some(wgpu::FragmentState {
                        module: shader_module,
                        entry_point: Some("fragment_main"),
                        targets: &[Some(wgpu::ColorTargetState {
                            format: context.texture_format(),
                            blend: None,
                            write_mask: wgpu::ColorWrites::ALL,
                        })],
                        compilation_options: wgpu::PipelineCompilationOptions::default(),
                    }),
                    primitive: wgpu::PrimitiveState::default(),
                    depth_stencil: None,
                    multisample: wgpu::MultisampleState::default(),
                    multiview_mask: None,
                    cache: None,
                })
        };

        let gaussian_blur_pipeline =
            make_pipeline("effects-gaussian-blur-pipeline", &gaussian_blur_shader_module);
        let vignette_pipeline =
            make_pipeline("effects-vignette-pipeline", &vignette_shader_module);
        let film_grain_pipeline =
            make_pipeline("effects-film-grain-pipeline", &film_grain_shader_module);
        let sharpen_pipeline = make_pipeline("effects-sharpen-pipeline", &sharpen_shader_module);
        let chromatic_aberration_pipeline = make_pipeline(
            "effects-chromatic-aberration-pipeline",
            &chromatic_aberration_shader_module,
        );

        let pipelines = HashMap::from([
            (GAUSSIAN_BLUR_SHADER_ID.to_string(), gaussian_blur_pipeline),
            (VIGNETTE_SHADER_ID.to_string(), vignette_pipeline),
            (FILM_GRAIN_SHADER_ID.to_string(), film_grain_pipeline),
            (SHARPEN_SHADER_ID.to_string(), sharpen_pipeline),
            (
                CHROMATIC_ABERRATION_SHADER_ID.to_string(),
                chromatic_aberration_pipeline,
            ),
        ]);

        Self {
            uniform_bind_group_layout,
            pipelines,
        }
    }

    pub fn apply(
        &self,
        context: &GpuContext,
        ApplyEffectsOptions {
            source,
            width,
            height,
            passes,
        }: ApplyEffectsOptions<'_>,
    ) -> Result<wgpu::Texture, EffectsError> {
        let mut encoder =
            context
                .device()
                .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                    label: Some("effects-command-encoder"),
                });
        let output = self.apply_with_encoder(
            context,
            &mut encoder,
            ApplyEffectsOptions {
                source,
                width,
                height,
                passes,
            },
        )?;
        context.queue().submit([encoder.finish()]);
        Ok(output)
    }

    pub fn apply_with_encoder(
        &self,
        context: &GpuContext,
        encoder: &mut wgpu::CommandEncoder,
        ApplyEffectsOptions {
            source,
            width,
            height,
            passes,
        }: ApplyEffectsOptions<'_>,
    ) -> Result<wgpu::Texture, EffectsError> {
        let mut current_texture: Option<wgpu::Texture> = None;

        for pass in passes {
            let input_texture = current_texture.as_ref().unwrap_or(source);
            let output_texture =
                context.create_render_texture(width, height, "effects-pass-output");
            let input_view = input_texture.create_view(&wgpu::TextureViewDescriptor::default());
            let output_view = output_texture.create_view(&wgpu::TextureViewDescriptor::default());
            let texture_bind_group =
                context
                    .device()
                    .create_bind_group(&wgpu::BindGroupDescriptor {
                        label: Some("effects-texture-bind-group"),
                        layout: context.texture_sampler_bind_group_layout(),
                        entries: &[
                            wgpu::BindGroupEntry {
                                binding: 0,
                                resource: wgpu::BindingResource::TextureView(&input_view),
                            },
                            wgpu::BindGroupEntry {
                                binding: 1,
                                resource: wgpu::BindingResource::Sampler(context.linear_sampler()),
                            },
                        ],
                    });
            let uniform_buffer =
                context
                    .device()
                    .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                        label: Some("effects-uniform-buffer"),
                        contents: bytemuck::bytes_of(&pack_effect_uniforms(pass, width, height)?),
                        usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
                    });
            let uniform_bind_group =
                context
                    .device()
                    .create_bind_group(&wgpu::BindGroupDescriptor {
                        label: Some("effects-uniform-bind-group"),
                        layout: &self.uniform_bind_group_layout,
                        entries: &[wgpu::BindGroupEntry {
                            binding: 0,
                            resource: uniform_buffer.as_entire_binding(),
                        }],
                    });
            let pipeline = self.pipelines.get(&pass.shader).ok_or_else(|| {
                EffectsError::UnknownEffectShader {
                    shader: pass.shader.clone(),
                }
            })?;

            {
                let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                    label: Some("effects-render-pass"),
                    color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                        view: &output_view,
                        resolve_target: None,
                        depth_slice: None,
                        ops: wgpu::Operations {
                            load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
                            store: wgpu::StoreOp::Store,
                        },
                    })],
                    depth_stencil_attachment: None,
                    occlusion_query_set: None,
                    timestamp_writes: None,
                    multiview_mask: None,
                });
                render_pass.set_pipeline(pipeline);
                render_pass.set_vertex_buffer(0, context.fullscreen_quad().slice(..));
                render_pass.set_bind_group(0, &texture_bind_group, &[]);
                render_pass.set_bind_group(1, &uniform_bind_group, &[]);
                render_pass.draw(0..6, 0..1);
            }

            current_texture = Some(output_texture);
        }

        current_texture.ok_or(EffectsError::MissingEffectPasses)
    }
}

fn pack_effect_uniforms(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<EffectUniformBuffer, EffectsError> {
    match pass.shader.as_str() {
        GAUSSIAN_BLUR_SHADER_ID => pack_gaussian_blur_uniforms(pass, width, height),
        VIGNETTE_SHADER_ID => pack_vignette_uniforms(pass, width, height),
        FILM_GRAIN_SHADER_ID => pack_film_grain_uniforms(pass, width, height),
        SHARPEN_SHADER_ID => pack_sharpen_uniforms(pass, width, height),
        CHROMATIC_ABERRATION_SHADER_ID => pack_chromatic_aberration_uniforms(pass, width, height),
        shader => Err(EffectsError::UnknownEffectShader {
            shader: shader.to_string(),
        }),
    }
}

fn pack_gaussian_blur_uniforms(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<EffectUniformBuffer, EffectsError> {
    let sigma = read_number_uniform(pass, "u_sigma")?;
    let step = read_number_uniform(pass, "u_step")?;
    let direction = read_vec2_uniform(pass, "u_direction")?;
    reject_unknown_uniforms(pass, &["u_sigma", "u_step", "u_direction"])?;
    Ok(EffectUniformBuffer {
        resolution: [width as f32, height as f32],
        direction,
        scalars: [sigma, step, 0.0, 0.0],
    })
}

fn pack_vignette_uniforms(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<EffectUniformBuffer, EffectsError> {
    let intensity = read_number_uniform(pass, "u_intensity")?;
    let softness = read_number_uniform(pass, "u_softness")?;
    reject_unknown_uniforms(pass, &["u_intensity", "u_softness"])?;
    Ok(EffectUniformBuffer {
        resolution: [width as f32, height as f32],
        direction: [0.0, 0.0],
        scalars: [intensity, softness, 0.0, 0.0],
    })
}

fn pack_film_grain_uniforms(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<EffectUniformBuffer, EffectsError> {
    let intensity = read_number_uniform(pass, "u_intensity")?;
    let seed = read_number_uniform(pass, "u_seed")?;
    reject_unknown_uniforms(pass, &["u_intensity", "u_seed"])?;
    Ok(EffectUniformBuffer {
        resolution: [width as f32, height as f32],
        direction: [0.0, 0.0],
        scalars: [intensity, seed, 0.0, 0.0],
    })
}

fn pack_sharpen_uniforms(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<EffectUniformBuffer, EffectsError> {
    let amount = read_number_uniform(pass, "u_amount")?;
    reject_unknown_uniforms(pass, &["u_amount"])?;
    Ok(EffectUniformBuffer {
        resolution: [width as f32, height as f32],
        direction: [0.0, 0.0],
        scalars: [amount, 0.0, 0.0, 0.0],
    })
}

fn pack_chromatic_aberration_uniforms(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<EffectUniformBuffer, EffectsError> {
    let intensity = read_number_uniform(pass, "u_intensity")?;
    reject_unknown_uniforms(pass, &["u_intensity"])?;
    Ok(EffectUniformBuffer {
        resolution: [width as f32, height as f32],
        direction: [0.0, 0.0],
        scalars: [intensity, 0.0, 0.0, 0.0],
    })
}

fn reject_unknown_uniforms(pass: &EffectPass, known: &[&str]) -> Result<(), EffectsError> {
    for uniform in pass.uniforms.keys() {
        if !known.contains(&uniform.as_str()) {
            return Err(EffectsError::UnsupportedUniform {
                shader: pass.shader.clone(),
                uniform: uniform.clone(),
            });
        }
    }
    Ok(())
}

fn read_number_uniform(pass: &EffectPass, uniform: &str) -> Result<f32, EffectsError> {
    let Some(value) = pass.uniforms.get(uniform) else {
        return Err(EffectsError::MissingUniform {
            shader: pass.shader.clone(),
            uniform: uniform.to_string(),
        });
    };
    match value {
        UniformValue::Number(value) => Ok(*value),
        UniformValue::Vector(_) => Err(EffectsError::InvalidNumberUniform {
            shader: pass.shader.clone(),
            uniform: uniform.to_string(),
        }),
    }
}

fn read_vec2_uniform(pass: &EffectPass, uniform: &str) -> Result<[f32; 2], EffectsError> {
    let Some(value) = pass.uniforms.get(uniform) else {
        return Err(EffectsError::MissingUniform {
            shader: pass.shader.clone(),
            uniform: uniform.to_string(),
        });
    };
    let UniformValue::Vector(values) = value else {
        return Err(EffectsError::InvalidVectorUniform {
            shader: pass.shader.clone(),
            uniform: uniform.to_string(),
            expected_length: 2,
        });
    };
    if values.len() != 2 {
        return Err(EffectsError::InvalidVectorUniform {
            shader: pass.shader.clone(),
            uniform: uniform.to_string(),
            expected_length: 2,
        });
    }
    Ok([values[0], values[1]])
}

#[cfg(test)]
mod tests {
    use super::*;

    fn effect_pass(shader: &str, uniforms: &[(&str, UniformValue)]) -> EffectPass {
        let uniforms = uniforms
            .iter()
            .map(|(key, value)| ((*key).to_string(), value.clone()))
            .collect();

        EffectPass {
            shader: shader.to_string(),
            uniforms,
        }
    }

    #[test]
    fn pack_vignette_uniforms_with_normal_params() {
        let pass = effect_pass(
            VIGNETTE_SHADER_ID,
            &[
                ("u_intensity", UniformValue::Number(0.5)),
                ("u_softness", UniformValue::Number(0.5)),
            ],
        );

        let packed = pack_vignette_uniforms(&pass, 1920, 1080).expect("should pack vignette");

        assert_eq!(packed.resolution, [1920.0, 1080.0]);
        assert_eq!(packed.direction, [0.0, 0.0]);
        assert_eq!(packed.scalars, [0.5, 0.5, 0.0, 0.0]);
    }

    #[test]
    fn pack_vignette_uniforms_allows_zero_softness() {
        let pass = effect_pass(
            VIGNETTE_SHADER_ID,
            &[
                ("u_intensity", UniformValue::Number(0.5)),
                ("u_softness", UniformValue::Number(0.0)),
            ],
        );

        let packed = pack_vignette_uniforms(&pass, 640, 360).expect("should pack vignette");

        assert_eq!(packed.resolution, [640.0, 360.0]);
        assert_eq!(packed.scalars, [0.5, 0.0, 0.0, 0.0]);
    }

    #[test]
    fn pack_vignette_uniforms_returns_error_when_uniform_is_missing() {
        let pass = effect_pass(
            VIGNETTE_SHADER_ID,
            &[("u_intensity", UniformValue::Number(0.5))],
        );

        match pack_vignette_uniforms(&pass, 1920, 1080) {
            Err(EffectsError::MissingUniform { shader, uniform }) => {
                assert_eq!(shader, VIGNETTE_SHADER_ID);
                assert_eq!(uniform, "u_softness");
            }
            Ok(_) => panic!("expected missing softness error, got Ok(_)"),
            Err(error) => panic!("expected missing softness error, got {error}"),
        }
    }

    #[test]
    fn pack_vignette_uniforms_rejects_unknown_uniforms() {
        let pass = effect_pass(
            VIGNETTE_SHADER_ID,
            &[
                ("u_intensity", UniformValue::Number(0.5)),
                ("u_softness", UniformValue::Number(0.5)),
                ("u_feather", UniformValue::Number(0.3)),
            ],
        );

        match pack_vignette_uniforms(&pass, 1920, 1080) {
            Err(EffectsError::UnsupportedUniform { shader, uniform }) => {
                assert_eq!(shader, VIGNETTE_SHADER_ID);
                assert_eq!(uniform, "u_feather");
            }
            Ok(_) => panic!("expected unsupported uniform error, got Ok(_)"),
            Err(error) => panic!("expected unsupported uniform error, got {error}"),
        }
    }

    #[test]
    fn pack_film_grain_uniforms_with_normal_params() {
        let pass = effect_pass(
            FILM_GRAIN_SHADER_ID,
            &[
                ("u_intensity", UniformValue::Number(0.15)),
                ("u_seed", UniformValue::Number(24.0)),
            ],
        );

        let packed = pack_film_grain_uniforms(&pass, 1280, 720).expect("should pack film grain");

        assert_eq!(packed.resolution, [1280.0, 720.0]);
        assert_eq!(packed.direction, [0.0, 0.0]);
        assert_eq!(packed.scalars, [0.15, 24.0, 0.0, 0.0]);
    }

    #[test]
    fn pack_sharpen_uniforms_with_normal_params() {
        let pass = effect_pass(
            SHARPEN_SHADER_ID,
            &[("u_amount", UniformValue::Number(0.75))],
        );

        let packed = pack_sharpen_uniforms(&pass, 800, 600).expect("should pack sharpen");

        assert_eq!(packed.resolution, [800.0, 600.0]);
        assert_eq!(packed.direction, [0.0, 0.0]);
        assert_eq!(packed.scalars, [0.75, 0.0, 0.0, 0.0]);
    }

    #[test]
    fn pack_chromatic_aberration_uniforms_with_normal_params() {
        let pass = effect_pass(
            CHROMATIC_ABERRATION_SHADER_ID,
            &[("u_intensity", UniformValue::Number(3.0))],
        );

        let packed =
            pack_chromatic_aberration_uniforms(&pass, 1024, 768).expect("should pack chromatic");

        assert_eq!(packed.resolution, [1024.0, 768.0]);
        assert_eq!(packed.direction, [0.0, 0.0]);
        assert_eq!(packed.scalars, [3.0, 0.0, 0.0, 0.0]);
    }

    #[test]
    fn pack_effect_uniforms_rejects_unknown_shader() {
        let pass = effect_pass("unknown-shader", &[]);

        match pack_effect_uniforms(&pass, 1920, 1080) {
            Err(EffectsError::UnknownEffectShader { shader }) => {
                assert_eq!(shader, "unknown-shader");
            }
            Ok(_) => panic!("expected unknown shader error, got Ok(_)"),
            Err(error) => panic!("expected unknown shader error, got {error}"),
        }
    }
}
