import { styled } from '@umijs/max';

export const AudioPlayerStyles = styled.div`
  // proCard 的样式
  .ant-pro-card-body {
    padding: 0px;
  }
  // proCard 的样式
  .audio-player {
    width: 100%;
    height: 80vh;
    background: white;
    margin: auto;
    overflow: hidden;
  }

  /* 背景与唱片均为纯 CSS 绘制（此前热链第三方 CDN 上的商业专辑封面与背景图） */
  .audio-player {
    background-image: linear-gradient(135deg, #1f2a44 0%, #2d1f3d 55%, #111827 100%);
    background-size: 100% 100%;
  }

  #left {
    position: absolute;
    top: 0;
    left: 0;
    width: 40%;
    height: 100%;
    margin-left: 10%;
  }

  #mask {
    position: absolute;
    left: 50%;
    top: 0;
    width: 50%;
    height: 100%;
    -webkit-mask-image: linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0) 0,
      rgba(255, 255, 255, 0.6) 15%,
      rgba(255, 255, 255, 1) 25%,
      rgba(255, 255, 255, 1) 75%,
      rgba(255, 255, 255, 0.1) 85%,
      rgba(255, 255, 255, 0) 100%
    );
  }

  #gc {
    height: 100%;
    display: block;
    position: relative;
  }

  #mse {
    position: absolute;
    bottom: 0;
    left: 0;
  }

  #album {
    height: 55%;
    background-image: radial-gradient(
      circle,
      #1677ff 0 10%,
      #0b0b0b 11% 38%,
      #2a2a2a 39% 41%,
      #0b0b0b 42% 58%,
      #2a2a2a 59% 61%,
      #0b0b0b 62% 70%,
      transparent 71%
    );
    background-size: 60%;
    background-repeat: no-repeat;
    background-position: center left;
  }

  #info {
    font-size: 18px;
    line-height: 40px;
    width: 53%;
    color: white;
  }

  #info > div {
    font-size: 12px;
    line-height: 16px;
    color: rgba(225, 225, 225, 0.8);
  }

  .xgplayer-lyric-item {
    display: block;
    text-align: center;
    line-height: 22px !important;
    font-size: 12px !important;
    color: rgba(225, 225, 225, 0.8) !important;
  }

  .xgplayer-lyric-item-active {
    color: rgb(49, 194, 124) !important;
  }

  #canvas {
    width: 100%;
    position: absolute;
    bottom: 45px;
    left: 0;
    z-index: 0;
    -webkit-mask-image: linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0.3) 0,
      rgba(255, 255, 255, 0.8) 70%,
      rgba(255, 255, 255, 0.9) 100%
    );
  }

  canvas {
    width: 100%;
  }

  .xgplayer-lrcWrap {
    border: 0px solid #ddd !important;
    height: 100% !important;
    padding: 0 !important;
  }

  .xgplayer-lrcForward {
    left: 0px !important;
  }

  .xgplayer-lrcBack {
    left: 0px !important;
    top: 75% !important;
  }

  .select {
    position: relative;
    height: 30px;
    margin: 50px 20px;
    line-height: 30px;
  }

  .select select {
    outline: none;
    width: 100px;
    height: 30px;
  }
`;
