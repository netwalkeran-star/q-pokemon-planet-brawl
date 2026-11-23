$ErrorActionPreference = "Stop"

$projectRoot = "d:\kenji xai\asteroid-snake"
$apkDir = Join-Path $projectRoot "android-apk"
$buildDir = Join-Path $apkDir "build"
$assetsDir = Join-Path $apkDir "assets"
$resDir = Join-Path $apkDir "res"
$drawableDir = Join-Path $resDir "drawable"

$sdkRoot = "C:\Users\kenjipc\AppData\Local\Android\Sdk"
$buildTools = Join-Path $sdkRoot "build-tools\35.0.0"
$androidJar = Join-Path $sdkRoot "platforms\android-34\android.jar"

$aapt2 = Join-Path $buildTools "aapt2.exe"
$d8 = Join-Path $buildTools "d8.bat"
$zipalign = Join-Path $buildTools "zipalign.exe"
$apksigner = Join-Path $buildTools "apksigner.bat"

Write-Host "==> 1. Building latest Vite web bundle..."
Set-Location $projectRoot
& npm.cmd run build

Write-Host "==> 2. Preparing Android APK directories & copying web assets..."
if (Test-Path $buildDir) { Remove-Item -Recurse -Force $buildDir }
if (Test-Path $assetsDir) { Remove-Item -Recurse -Force $assetsDir }
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $buildDir "gen") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $buildDir "obj") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $buildDir "dex") | Out-Null
New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null
New-Item -ItemType Directory -Force -Path $drawableDir | Out-Null

# Copy Vite dist files (excluding any old .apk) into Android assets
Get-ChildItem -Path (Join-Path $projectRoot "dist") -Exclude "*.apk" | Copy-Item -Destination $assetsDir -Recurse -Force

Write-Host "==> 3. Generating 192x192 App Launcher Icon..."
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap(192, 192)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::FromArgb(255, 135, 206, 235)) # Sunny sky blue
$oceanBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 30, 136, 229))
$g.FillEllipse($oceanBrush, 16, 16, 160, 160)
$landBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 82, 183, 56))
$g.FillEllipse($landBrush, 30, 32, 132, 128)
$goldBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 214, 10))
$pts = @(
    (New-Object System.Drawing.Point(108, 28)),
    (New-Object System.Drawing.Point(68, 98)),
    (New-Object System.Drawing.Point(98, 98)),
    (New-Object System.Drawing.Point(80, 164)),
    (New-Object System.Drawing.Point(128, 88)),
    (New-Object System.Drawing.Point(98, 88))
)
$g.FillPolygon($goldBrush, $pts)
$iconPath = Join-Path $drawableDir "ic_launcher.png"
$bmp.Save($iconPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()

Write-Host "==> 4. Compiling & Linking resources + assets with aapt2..."
$compiledResZip = Join-Path $buildDir "compiled_res.zip"
& $aapt2 compile --dir $resDir -o $compiledResZip

$unalignedApk = Join-Path $buildDir "unaligned.apk"
& $aapt2 link -o $unalignedApk `
    -I $androidJar `
    --manifest (Join-Path $apkDir "AndroidManifest.xml") `
    --java (Join-Path $buildDir "gen") `
    -A $assetsDir `
    $compiledResZip

Write-Host "==> 5. Compiling Java sources with javac..."
$mainJava = Join-Path $apkDir "src\com\kenji\pokemonplanetsnake\MainActivity.java"
$rJava = Join-Path $buildDir "gen\com\kenji\pokemonplanetsnake\R.java"
& javac -source 11 -target 11 -encoding UTF-8 -cp $androidJar -d (Join-Path $buildDir "obj") $mainJava $rJava

Write-Host "==> 6. Converting bytecode to DEX with d8..."
$classFiles = Get-ChildItem -Path (Join-Path $buildDir "obj") -Recurse -Filter "*.class" | ForEach-Object { $_.FullName }
& $d8 --lib $androidJar --output (Join-Path $buildDir "dex") $classFiles

Write-Host "==> 7. Packaging classes.dex into APK..."
& jar -uf $unalignedApk -C (Join-Path $buildDir "dex") classes.dex

Write-Host "==> 8. Aligning APK with zipalign..."
$alignedApk = Join-Path $buildDir "aligned.apk"
& $zipalign -f -p 4 $unalignedApk $alignedApk

Write-Host "==> 9. Signing APK with apksigner..."
$keystore = Join-Path $apkDir "release-key.jks"
if (-not (Test-Path $keystore)) {
    & keytool -genkeypair -v -keystore $keystore -alias pokemonkey -keyalg RSA -keysize 2048 -validity 10000 -storepass 123456 -keypass 123456 -dname "CN=Kenji, OU=Game, O=Kenji, L=Taipei, S=Taiwan, C=TW"
}

$finalApk = Join-Path $projectRoot "pokemon-planet-snake-ai.apk"
& $apksigner sign --ks $keystore --ks-key-alias pokemonkey --ks-pass pass:123456 --key-pass pass:123456 --out $finalApk $alignedApk

# Also copy into dist/ so it can be downloaded directly from Netlify if desired
Copy-Item -Path $finalApk -Destination (Join-Path $projectRoot "dist\pokemon-planet-snake-ai.apk") -Force

Write-Host "==> SUCCESS! APK built at: $finalApk"
Get-Item $finalApk | Select-Object FullName, Length, LastWriteTime
