/**
 * Script to download DreamShaper_8.safetensors using the model downloader
 */

const { downloadCheckpoint } = require('../lib/model-downloader');

async function main() {
  console.log('Starting download of DreamShaper_8.safetensors...');
  console.log('');
  
  const result = await downloadCheckpoint('DreamShaper_8.safetensors', (progress) => {
    if (typeof progress === 'number' && progress <= 100) {
      process.stdout.write(`\rDownload progress: ${Math.round(progress)}%`);
    } else {
      const mb = ((progress as number) / (1024 * 1024)).toFixed(2);
      process.stdout.write(`\rDownloaded: ${mb} MB`);
    }
  });
  
  console.log('');
  if (result) {
    console.log('✅ Successfully downloaded DreamShaper_8.safetensors');
    console.log(`   Location: ${result}`);
  } else {
    console.log('❌ Download failed');
    process.exit(1);
  }
}

main().catch(console.error);
