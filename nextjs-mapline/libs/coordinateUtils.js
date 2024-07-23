/*import numeric from 'numeric';

// Known points
const points = [

    { lat: 25, lon: -125, x: 30.2, y: 1083.1 },
    { lat: 25, lon: -120, x: 274, y: 1142.3 },
    { lat: 25, lon: -115, x: 470.7, y: 1190.7 },
    { lat: 25, lon: -110, x: 669.8, y: 1228.3 },
    { lat: 25, lon: -105, x: 870.7, y: 1254.8 },
    { lat: 25, lon: -100, x: 1072.7, y: 1270.3 },
    { lat: 25, lon: -95, x: 1275.3, y: 1274.6 },
    { lat: 25, lon: -90, x: 1477.8, y: 1267.8 },
    { lat: 25, lon: -85, x: 1679.6, y: 1249.8 },
    { lat: 25, lon: -80, x: 1880.2, y: 1220.8 },
    { lat: 25, lon: -75, x: 2078.8, y: 1180.8 },
    { lat: 25, lon: -70, x: 2274.9, y: 1129.9 },
    { lat: 25, lon: -65, x: 2468, y: 1068.4 },
    
    { lat: 30, lon: -125, x: 150.7, y: 873 },
    { lat: 30, lon: -120, x: 332.8, y: 928.6 },
    { lat: 30, lon: -115, x: 517.7, y: 974.2 },
    { lat: 30, lon: -110, x: 704.9 , y: 1009.5 },
    { lat: 30, lon: -105, x: 893.7, y: 1034.4 },
    { lat: 30, lon: -100, x: 1083.5, y: 1048.9 },
    { lat: 30, lon: -95, x: 1273.9, y: 1053 },
    { lat: 30, lon: -90, x: 1464.2, y: 1046.6 },
    { lat: 30, lon: -85, x: 1653.9, y: 1029.7 },
    { lat: 30, lon: -80, x: 1842.4, y: 1002.4 },
    { lat: 30, lon: -75, x: 2029.1, y: 964.8 },
    { lat: 30, lon: -70, x: 2213.4, y: 917 },
    { lat: 30, lon: -65, x: 2394.8, y: 859.2 },

    { lat: 35, lon: -125, x: 220.3, y: 665.7 },
    { lat: 35, lon: -120, x: 391, y: 717.8 },
    { lat: 35, lon: -115, x: 564.2, y: 760.4 },
    { lat: 35, lon: -110, x: 739.5, y: 793.5 },
    { lat: 35, lon: -105, x: 916.3, y: 816.9 },
    { lat: 35, lon: -100, x: 1094.2, y: 830.5 },
    { lat: 35, lon: -95, x: 1272.6, y: 834.3 },
    { lat: 35, lon: -90, x: 1450.9, y: 828.3 },
    { lat: 35, lon: -85, x: 1628.6, y: 812.5 },
    { lat: 35, lon: -80, x: 1805.1, y: 786.9 },
    { lat: 35, lon: -75, x: 1980, y: 751.7 },
    { lat: 35, lon: -70, x: 2152.7, y: 706.9 },
    { lat: 35, lon: -65, x: 2322.6, y: 652.7 },

    { lat: 40, lon: -125, x: 289.5, y: 459.6 },
    { lat: 40, lon: -120, x: 448.7, y: 508.2 },
    { lat: 40, lon: -115, x: 610.3, y: 548 },
    { lat: 40, lon: -110, x: 773.9, y: 578.8 },
    { lat: 40, lon: -105, x: 938.9, y: 600.6 },
    { lat: 40, lon: -100, x: 1104.8, y: 613.3 },
    { lat: 40, lon: -95, x: 1271.2, y: 616.9 },
    { lat: 40, lon: -90, x: 1437.6, y: 611.2 },
    { lat: 40, lon: -85, x: 1603.4, y: 596.5 },
    { lat: 40, lon: -80, x: 1768.1, y: 572.7 },
    { lat: 40, lon: -75, x: 1931.2, y: 539.8 },
    { lat: 40, lon: -70, x: 2092.3, y: 498 },
    { lat: 40, lon: -65, x: 2250.9, y: 447.4 },

    { lat: 45, lon: -125, x: 358.9, y: 253.1 },
    { lat: 45, lon: -120, x: 506.6, y: 298.3 },
    { lat: 45, lon: -115, x: 656.5, y: 335.2 },
    { lat: 45, lon: -110, x: 808.3, y: 363.8 },
    { lat: 45, lon: -105, x: 961.5, y: 384 },
    { lat: 45, lon: -100, x: 1115.5, y: 395.8 },
    { lat: 45, lon: -95, x: 1269.9, y: 399.1 },
    { lat: 45, lon: -90, x: 1424.3, y: 393.9 },
    { lat: 45, lon: -85, x: 1578.1, y: 380.2 },
    { lat: 45, lon: -80, x: 1731, y: 358.1 },
    { lat: 45, lon: -75, x: 1882.4, y: 327.6 },
    { lat: 45, lon: -70, x: 2031.9, y: 288.8 },
    { lat: 45, lon: -65, x: 2179.1, y: 241.9 },

    { lat: 50, lon: -120, x: 565, y: 86.3 },
    { lat: 50, lon: -115, x: 703.2, y: 120.4 },
    { lat: 50, lon: -110, x: 843.1, y: 146.8 },
    { lat: 50, lon: -105, x: 984.2, y: 165.4 },
    { lat: 50, lon: -100, x: 1126.2, y: 176.3 },
    { lat: 50, lon: -95, x: 1268.5, y: 179.3 },
    { lat: 50, lon: -90, x: 1410.8, y: 174.5 },
    { lat: 50, lon: -85, x: 1552.6, y: 161.9 },
    { lat: 50, lon: -80, x: 1693.5, y: 141.5 },
    { lat: 50, lon: -75, x: 1833.1, y: 113.4 },
    { lat: 50, lon: -70, x: 1970.9, y: 77.7 },
    { lat: 50, lon: -65, x: 2106.5, y: 34.4 },

    { lat: 21.3099, lon: -157.8581, x: -1184.9, y: 742.4 }, // Honolulu
    
];

// Prepare matrices for polynomial regression
function prepareMatrices() {
    const A = [];
    const Bx = [];
    const By = [];
  
    points.forEach(({ lat, lon, x, y }) => {
      A.push([1, lon, lat, lon * lat, lon ** 2, lat ** 2]);
      Bx.push(x);
      By.push(y);
    });
  
    return { A, Bx, By };
}
  
// Calculate coefficients using polynomial regression
function computeCoefficients() {
    const { A, Bx, By } = prepareMatrices();

    const A_matrix = numeric.clone(A);
    const Bx_matrix = numeric.clone(Bx);
    const By_matrix = numeric.clone(By);

    const svdA = numeric.svd(A_matrix);
    const U = svdA.U;
    const S = svdA.S;
    const V = svdA.V;

    const S_inv = numeric.diag(S.map(value => (value === 0 ? 0 : 1 / value)));

    const A_pinv = numeric.dot(numeric.dot(V, S_inv), numeric.transpose(U));

    const coeffsX = numeric.dot(A_pinv, Bx_matrix);
    const coeffsY = numeric.dot(A_pinv, By_matrix);

    return { coeffsX, coeffsY };
}

const { coeffsX, coeffsY } = computeCoefficients();

export function latLonToX(latitude, longitude) {
    const x = coeffsX[0] + coeffsX[1] * longitude + coeffsX[2] * latitude + coeffsX[3] * longitude * latitude + coeffsX[4] * longitude ** 2 + coeffsX[5] * latitude ** 2;
    const y = coeffsY[0] + coeffsY[1] * longitude + coeffsY[2] * latitude + coeffsY[3] * longitude * latitude + coeffsY[4] * longitude ** 2 + coeffsY[5] * latitude ** 2;

    return x;
}

export function latLonToY(latitude, longitude) {
    const x = coeffsX[0] + coeffsX[1] * longitude + coeffsX[2] * latitude + coeffsX[3] * longitude * latitude + coeffsX[4] * longitude ** 2 + coeffsX[5] * latitude ** 2;
    const y = coeffsY[0] + coeffsY[1] * longitude + coeffsY[2] * latitude + coeffsY[3] * longitude * latitude + coeffsY[4] * longitude ** 2 + coeffsY[5] * latitude ** 2;

    return y;
}*/