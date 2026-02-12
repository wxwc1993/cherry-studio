import { Carousel } from 'antd'
import type { FC } from 'react'

import type { LcBanner } from '../hooks/useLearningCenter'

interface CarouselBannerProps {
  banners: LcBanner[]
}

const PLACEHOLDER_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="200"%3E%3Crect fill="%23e5e7eb" width="800" height="200"/%3E%3C/svg%3E'

const CarouselBanner: FC<CarouselBannerProps> = ({ banners }) => {
  if (banners.length === 0) {
    return null
  }

  const handleBannerClick = (banner: LcBanner) => {
    if (!banner.linkUrl) return
    if (/^https?:\/\//i.test(banner.linkUrl)) {
      window.open(banner.linkUrl, '_blank')
    }
  }

  return (
    <div className="mt-6 overflow-hidden rounded-xl">
      <Carousel autoplay autoplaySpeed={5000} dots={{ className: 'custom-carousel-dots' }}>
        {banners.map((banner) => (
          <div key={banner.id}>
            <div
              className="relative h-48 w-full overflow-hidden"
              style={{ cursor: banner.linkUrl ? 'pointer' : 'default' }}
              onClick={() => handleBannerClick(banner)}>
              <img
                src={banner.imageUrl}
                alt={banner.title}
                className="h-full w-full object-cover"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE
                }}
              />
              <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/50 to-transparent p-4">
                <span className="font-medium text-white">{banner.title}</span>
              </div>
            </div>
          </div>
        ))}
      </Carousel>
    </div>
  )
}

export default CarouselBanner
