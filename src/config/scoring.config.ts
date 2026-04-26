export interface ScoringRule {
  keywords: string[];
  score: number;
}

export interface ScoringConfig {
  backendPositive: ScoringRule[];
  frontendNegative: ScoringRule[];
  neutral: string[];
  thresholdHigh: number;
  thresholdLow: number;
}

export const scoringConfig: ScoringConfig = {
  backendPositive: [
    { keywords: ['node.js', 'nodejs', 'express', 'nestjs', 'nest.js', 'koa', 'fastify'], score: 3 },
    { keywords: ['spring', 'spring boot', 'springboot', 'spring-boot'], score: 3 },
    { keywords: ['django', 'flask', 'fastapi'], score: 3 },
    { keywords: ['go', 'golang', 'gin', 'echo'], score: 3 },
    { keywords: ['rust', 'actix', 'axum'], score: 3 },
    { keywords: ['java', 'kotlin', 'jvm'], score: 2 },
    { keywords: ['python'], score: 1 },
    { keywords: ['typescript', 'javascript'], score: 1 },
    { keywords: ['postgresql', 'mysql', 'mariadb', 'oracle', 'mssql'], score: 2 },
    { keywords: ['mongodb', 'redis', 'elasticsearch', 'opensearch', 'dynamodb'], score: 2 },
    { keywords: ['docker', 'kubernetes', 'k8s', 'container'], score: 2 },
    { keywords: ['aws', 'gcp', 'azure', 'cloud'], score: 1 },
    { keywords: ['rest api', 'restful', 'graphql', 'grpc', 'protobuf'], score: 2 },
    { keywords: ['microservice', 'msa', 'event driven', 'event-driven'], score: 2 },
    { keywords: ['kafka', 'rabbitmq', 'message queue', 'sqs', 'pub/sub'], score: 2 },
    { keywords: ['ci/cd', 'devops', 'infrastructure', 'iac'], score: 1 },
    { keywords: ['terraform', 'ansible', 'helm'], score: 1 },
    { keywords: ['백엔드', 'back-end', 'backend', '서버 개발', '서버개발'], score: 2 },
    { keywords: ['api 설계', 'api 개발', 'api설계', 'api개발'], score: 2 },
  ],

  frontendNegative: [
    { keywords: ['react', 'react.js', 'reactjs'], score: -3 },
    { keywords: ['vue', 'vue.js', 'vuejs'], score: -3 },
    { keywords: ['angular', 'angularjs'], score: -3 },
    { keywords: ['next.js', 'nextjs', 'nuxt', 'nuxtjs'], score: -2 },
    { keywords: ['svelte', 'solid.js', 'solidjs'], score: -2 },
    { keywords: ['css', 'scss', 'sass', 'tailwind', 'styled-components', 'emotion'], score: -2 },
    { keywords: ['figma', 'sketch', 'zeplin', 'adobe xd'], score: -3 },
    { keywords: ['html', 'html5'], score: -1 },
    { keywords: ['webpack', 'vite', 'babel', 'rollup', 'esbuild'], score: -2 },
    { keywords: ['storybook', 'chromatic'], score: -2 },
    { keywords: ['responsive', 'cross-browser', '크로스브라우저', '반응형'], score: -2 },
    { keywords: ['프론트엔드', 'front-end', 'frontend', '웹 퍼블리셔', '퍼블리셔'], score: -3 },
    { keywords: ['ios', 'swift', 'swiftui', 'android', 'flutter', 'react native'], score: -3 },
  ],

  neutral: [
    'software engineer',
    '소프트웨어 엔지니어',
    '개발자',
    'developer',
    'engineer',
    'backend',
    'back-end',
    '백엔드',
    'server',
    '서버',
    'frontend',
    'front-end',
    '프론트엔드',
  ],

  thresholdHigh: Number(process.env.SCORE_THRESHOLD_HIGH) || 5,
  thresholdLow: Number(process.env.SCORE_THRESHOLD_LOW) || -2,
};
