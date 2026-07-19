// 영수증 이미지 압축 (localStorage 용량 절약)
// 긴 변 maxSize 로 리사이즈 후 JPEG 로 인코딩
export function compressImage(file, maxSize = 900, quality = 0.6) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) { reject(new Error('이미지 파일이 아니에요')); return }
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > height && width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize }
        else if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => reject(new Error('이미지를 읽을 수 없어요'))
      img.src = reader.result
    }
    reader.onerror = () => reject(new Error('파일 읽기 실패'))
    reader.readAsDataURL(file)
  })
}
