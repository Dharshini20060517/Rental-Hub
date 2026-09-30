 
import ZAI from 'z-ai-web-dev-sdk'
import fs from 'fs'
import path from 'path'

const OUTPUT_DIR = 'public/uploads/equipment'

const IMAGE_PROMPTS = [
  { file: 'bosch_drill.png', prompt: 'Professional product photo of a blue Bosch impact drill machine, on white background, studio lighting, high quality' },
  { file: 'dewalt_cordless.png', prompt: 'Professional product photo of a yellow black DeWalt 20V cordless drill kit, on white background, studio lighting' },
  { file: 'makita_saw.png', prompt: 'Professional product photo of a Makita circular saw power tool with blade, on white background, studio lighting' },
  { file: 'angle_grinder.png', prompt: 'Professional product photo of an angle grinder power tool, on white background, studio lighting' },
  { file: 'milwaukee_hammer.png', prompt: 'Professional product photo of a red Milwaukee rotary hammer drill, on white background, studio lighting' },
  { file: 'orbital_sander.png', prompt: 'Professional product photo of an orbital sander power tool, on white background, studio lighting' },
  { file: 'pipe_wrench.png', prompt: 'Professional product photo of a set of professional pipe wrenches, on white background, studio lighting' },
  { file: 'impact_driver.png', prompt: 'Professional product photo of a cordless impact driver kit, on white background, studio lighting' },
  { file: 'concrete_mixer.png', prompt: 'Professional product photo of a portable concrete cement mixer machine, on white background, studio lighting' },
  { file: 'needle_vibrator.png', prompt: 'Professional product photo of a concrete needle vibrator tool, on white background, studio lighting' },
  { file: 'scaffolding.png', prompt: 'Professional product photo of aluminum scaffolding tower, on white background, studio lighting' },
  { file: 'bar_bending.png', prompt: 'Professional product photo of a bar bending machine for steel rebar, on white background, studio lighting' },
  { file: 'mini_excavator.png', prompt: 'Professional product photo of a yellow mini excavator construction machine, on white background, studio lighting' },
  { file: 'backhoe_loader.png', prompt: 'Professional product photo of a yellow backhoe loader JCB machine, on white background, studio lighting' },
  { file: 'plate_compactor.png', prompt: 'Professional product photo of a plate compactor machine, on white background, studio lighting' },
  { file: 'vibratory_roller.png', prompt: 'Professional product photo of a soil vibratory roller machine, on white background, studio lighting' },
  { file: 'tata_pickup.png', prompt: 'Professional product photo of a white Tata pickup truck, on white background, studio lighting' },
  { file: 'cargo_van.png', prompt: 'Professional product photo of a white cargo van delivery vehicle, on white background, studio lighting' },
  { file: 'mini_tipper.png', prompt: 'Professional product photo of a three wheeler mini tipper truck, on white background, studio lighting' },
  { file: 'jbl_speaker.png', prompt: 'Professional product photo of a JBL PA speaker system, black, on white background, studio lighting' },
  { file: 'epson_projector.png', prompt: 'Professional product photo of an Epson projector device, on white background, studio lighting' },
  { file: 'wireless_mics.png', prompt: 'Professional product photo of a set of wireless microphones with receiver, on white background, studio lighting' },
  { file: 'stage_lighting.png', prompt: 'Professional product photo of a stage lighting truss with LED lights, on white background, studio lighting' },
  { file: 'event_tent.png', prompt: 'Professional product photo of a large white event party tent, on white background, studio lighting' },
  { file: 'banquet_tables.png', prompt: 'Professional product photo of round banquet tables for events, on white background, studio lighting' },
  { file: 'folding_chairs.png', prompt: 'Professional product photo of stack of white folding chairs, on white background, studio lighting' },
  { file: 'bouncy_castle.png', prompt: 'Professional product photo of a colorful inflatable bouncy castle, on white background, studio lighting' },
  { file: 'dome_tent.png', prompt: 'Professional product photo of a green dome camping tent, on white background, studio lighting' },
  { file: 'trekking_backpack.png', prompt: 'Professional product photo of a 60L trekking backpack, on white background, studio lighting' },
  { file: 'camping_stove.png', prompt: 'Professional product photo of a portable camping stove cookset, on white background, studio lighting' },
  { file: 'sony_camera.png', prompt: 'Professional product photo of a Sony mirrorless camera with lens, black, on white background, studio lighting' },
  { file: 'sigma_lens.png', prompt: 'Professional product photo of a Sigma telephoto camera lens, black, on white background, studio lighting' },
  { file: 'pressure_washer.png', prompt: 'Professional product photo of a Karcher pressure washer machine, on white background, studio lighting' },
  { file: 'wet_dry_vacuum.png', prompt: 'Professional product photo of an industrial wet dry vacuum cleaner, on white background, studio lighting' },
]

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  console.log(`Generating ${IMAGE_PROMPTS.length} equipment images…`)
  let success = 0, failed = 0
  const zai = await ZAI.create()

  for (const { file, prompt } of IMAGE_PROMPTS) {
    const outputPath = path.join(OUTPUT_DIR, file)
    if (fs.existsSync(outputPath)) { console.log(`✓ Skip: ${file}`); success++; continue }
    try {
      console.log(`Generating: ${file}…`)
      const response = await zai.images.generations.create({ prompt, size: '1024x1024' })
      if (response.data?.[0]?.base64) {
        fs.writeFileSync(outputPath, Buffer.from(response.data[0].base64, 'base64'))
        console.log(`✓ ${file}`)
        success++
      } else { failed++ }
    } catch (err) {
      console.error(`✗ ${file}: ${err instanceof Error ? err.message : 'error'}`)
      failed++
    }
  }
  console.log(`Done! ${success} success, ${failed} failed`)
}

main().catch(console.error)
