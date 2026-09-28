#!/usr/bin/env bash
# Uso: post_backdrop.sh far.png near.png  -> public/totem/bg-far.webp y bg-near.webp
set -e
FAR="$1"; NEAR="$2"; OUT="$(dirname "$0")/../../public/totem"
mkdir -p "$OUT"
# bloom solo de las zonas muy claras, sobre RGB (no YUV) para no lavar los negros
ffmpeg -y -loglevel error -i "$FAR" -filter_complex \
  "format=gbrp,split[a][b];[b]lutrgb=r='clip((val-190)*3,0,255)':g='clip((val-190)*3,0,255)':b='clip((val-190)*3,0,255)',gblur=sigma=12[bl];[a][bl]blend=all_mode=screen:all_opacity=0.6,vignette=angle=PI/4.4,format=yuv420p" \
  -frames:v 1 -c:v libwebp -quality 88 "$OUT/bg-far.webp"
ffmpeg -y -loglevel error -i "$NEAR" -frames:v 1 -c:v libwebp -quality 82 "$OUT/bg-near.webp"
ls -la "$OUT"
