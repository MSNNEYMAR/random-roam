/**
 * API 供应商配置
 *
 * 切换方式: 改 CURRENT_PROVIDER 的值即可
 *  'amap'   → 高德地图 (国内推荐)
 *  'google' → Google Places (海外推荐)
 *  'mock'   → 静态演示数据 (无需 API Key)
 */

export const CURRENT_PROVIDER = 'amap'

export const PROVIDER_CONFIG = {
  amap: {
    // 高德 Web服务 API Key → 去 https://console.amap.com/dev/ 申请
    apiKey: '2eddcc5161801eaa3a51f1e09fa412a1',
    // 搜索半径 (米)
    radius: 5000,
    // POI 类型映射 (高德分类编码)
    typeMap: {
      culture: '博物馆|美术馆|展览馆|文化宫|名胜古迹|教堂|寺庙|名人故居|历史建筑|纪念馆|景区',
      cafe:    '咖啡馆|茶馆|书店|特色商业街|创意园区|文艺街区|步行街',
      park:    '公园|植物园|动物园|城市广场|风景名胜|湿地公园|滨江|步道',
      food:    '餐厅|火锅|烧烤|小吃|美食|老字号|本帮菜|面馆|酒楼|饭店',
    },
  },

  google: {
    // Google Cloud API Key → 去 https://console.cloud.google.com/ 申请
    // 需要启用 Places API
    apiKey: 'YOUR_GOOGLE_API_KEY',
    radius: 5000,
    // Place Types → https://developers.google.com/maps/documentation/places/web-service/supported_types
    typeMap: {
      culture: 'museum|art_gallery|church|hindu_temple|mosque|tourist_attraction',
      cafe:    'cafe|book_store|restaurant|shopping_mall',
      park:    'park|tourist_attraction',
    },
  },
}

// ==================== 类别元数据 (给 API 返回的地点补默认值) ====================
export const CATEGORY_DEFAULTS = {
  culture: {
    suggestedStay: 50,  // 分钟
    icon: '🏛️',
    label: '文化 / 艺术',
  },
  cafe: {
    suggestedStay: 35,
    icon: '☕',
    label: '咖啡 / 小店',
  },
  park: {
    suggestedStay: 40,
    icon: '🌿',
    label: '公园 / 散步',
  },
  food: {
    suggestedStay: 45,
    icon: '🍜',
    label: '美食 / 餐厅',
  },
}

// 各类地点的默认小贴士 (API 拿不到，自己补)
export const DEFAULT_TIPS = {
  culture: [
    '慢慢逛，每个展品背后都有一段故事',
    '拍照的时候记得关掉闪光灯哦',
    '文创店的周边常常有惊喜',
  ],
  cafe: [
    '窗边的位置永远是最好的',
    '不妨和店主聊聊，每家店都有故事',
    '点一杯招牌饮品，坐一会儿再出发',
  ],
  park: [
    '找个长椅坐下，看云发呆也很幸福',
    '深呼吸，感受一下大自然的气息',
    '看看身边的人，每个人都在用自己的方式享受时光',
  ],
  food: [
    '空腹进去，扶墙出来~',
    '招牌菜一定是老板最用心的那道',
    '排队越长越值得等，慢慢品尝别着急',
  ],
}
