import styled from 'styled-components';

export const SignatureStyle = styled.div`
  .wrapper {
    position: relative;
    /* 随容器自适应宽度（保留 600px 上限），高度按 2:1 比例联动；
       组件内 resizeCanvas 已按 offsetWidth 重算画布，无需固定像素 */
    width: 100%;
    max-width: 600px;
    aspect-ratio: 2 / 1;
    -moz-user-select: none;
    -webkit-user-select: none;
    -ms-user-select: none;
    user-select: none;
  }

  .signature-pad {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: white;
    border: 1px solid #e8e8e8;
    border-radius: 8px;
  }
`;
