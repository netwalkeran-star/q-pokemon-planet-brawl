$ErrorActionPreference = "Stop"

$projectRoot = "d:\kenji xai\asteroid-snake"
$apkDir = Join-Path $projectRoot "android-apk-brawl"
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

Write-Host "==> 1. Building latest Vite web bundle (including /brawl/)..."
Set-Location $projectRoot
& npm.cmd run build

Write-Host "==> 2. Preparing Android Brawl APK directories & copying web assets..."
if (Test-Path $buildDir) { Remove-Item -Recurse -Force $buildDir }
if (Test-Path $assetsDir) { Remove-Item -Recurse -Force $assetsDir }
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $buildDir "gen") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $buildDir "obj") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $buildDir "dex") | Out-Null
New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null
New-Item -ItemType Directory -Force -Path $drawableDir | Out-Null

# Copy Vite dist files (excluding any .apk) into Android assets
Get-ChildItem -Path (Join-Path $projectRoot "dist") -Exclude "*.apk" | Copy-Item -Destination $assetsDir -Recurse -Force

Write-Host "==> 3. Generating 192x192 Brawl App Launcher Icon..."
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap(192, 192)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::FromArgb(255, 14, 165, 233))
$planetBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 16, 185, 129))
$g.FillEllipse($planetBrush, 18, 18, 156, 156)
$goldBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 250, 204, 21))
$pts = @(
    (New-Object System.Drawing.Point(96, 26)),
    (New-Object System.Drawing.Point(116, 78)),
    (New-Object System.Drawing.Point(168, 96)),
    (New-Object System.Drawing.Point(116, 114)),
    (New-Object System.Drawing.Point(96, 166)),
    (New-Object System.Drawing.Point(76, 114)),
    (New-Object System.Drawing.Point(24, 96)),
    (New-Object System.Drawing.Point(76, 78))
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
$mainJava = Join-Path $apkDir "src\com\kenji\pokemonplanetbrawl\MainActivity.java"
$rJava = Join-Path $buildDir "gen\com\kenji\pokemonplanetbrawl\R.java"
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
    & keytool -genkeypair -v -keystore $keystore -alias brawlkey -keyalg RSA -keysize 2048 -validity 10000 -storepass 123456 -keypass 123456 -dname "CN=Kenji, OU=Brawl, O=Kenji, L=Taipei, S=Taiwan, C=TW"
}

$finalApk = Join-Path $projectRoot "pokemon-planet-brawl.apk"
& $apksigner sign --ks $keystore --ks-key-alias brawlkey --ks-pass pass:123456 --key-pass pass:123456 --out $finalApk $alignedApk

# Copy into dist/ so GitHub Pages / static hosts can serve direct APK download
Copy-Item -Path $finalApk -Destination (Join-Path $projectRoot "dist\pokemon-planet-brawl.apk") -Force

Write-Host "==> SUCCESS! Brawl APK built at: $finalApk"
Get-Item $finalApk | Select-Object FullName, Length, LastWriteTime
