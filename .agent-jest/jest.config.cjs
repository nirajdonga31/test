module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testPathIgnorePatterns: ['/dist/', '/artifacts/', '/node_modules/'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverage: false,
};
