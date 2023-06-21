## [1.6.12-dev.2](https://github.com/VenusProtocol/oracle/compare/v1.6.12-dev.1...v1.6.12-dev.2) (2023-06-21)

## [1.6.12-dev.1](https://github.com/VenusProtocol/oracle/compare/v1.6.11...v1.6.12-dev.1) (2023-06-16)

## [1.6.11](https://github.com/VenusProtocol/oracle/compare/v1.6.10...v1.6.11) (2023-06-13)

## 1.0.0 (2023-05-26)


### Features

* add PriceOracle interface ([2ef3b18](https://github.com/VenusProtocol/oracle/commit/2ef3b18456e1ffc078ab2b600b8bcc2a96b4d669))
* conditionally deploy mock oracles in non live environments ([a29175e](https://github.com/VenusProtocol/oracle/commit/a29175ed90334ec8168fd1739f97f5d8f610e5d2))
* include contracts in package ([1a09129](https://github.com/VenusProtocol/oracle/commit/1a09129b21606abcac5b13cc4e38f4168ace3481))
* publish from ci ([53a7171](https://github.com/VenusProtocol/oracle/commit/53a7171fc6b1b67c9f56975209484d6415efc62a))


### Bug Fixes

* add faucet ([0f7b8f1](https://github.com/VenusProtocol/oracle/commit/0f7b8f18fb982bf09d27372d907461f788570ece))
* add missing types for sinon-chai ([2a45a57](https://github.com/VenusProtocol/oracle/commit/2a45a57f2e7198d35de8e927a1ab4c624c7de88a))
* BOV-01 | `BinanceOracle` Does Not Properly Implement `OracleInterface` ([c4799d0](https://github.com/VenusProtocol/oracle/commit/c4799d087ca2d1940854b7bee1c834fc2e59c2f9))
* BOV-02 | Gas Optimizations When Comparing Strings ([d7e1588](https://github.com/VenusProtocol/oracle/commit/d7e15884f5f6a2def4875b775d203e0b90bbac05))
* configure resilient oracle for local deployment ([bdec0e5](https://github.com/VenusProtocol/oracle/commit/bdec0e5798f262e44e1ceeaf7d31ccf5cd9d402c))
* configure resilient oracle for local deployment ([140d186](https://github.com/VenusProtocol/oracle/commit/140d1860ae0f8f94438ecc0cd7dac8a2c04699a7))
* COV-01 | Chainlink Can Return Negative Price That Will Not Be Reverted ([78921ef](https://github.com/VenusProtocol/oracle/commit/78921ef20f98cc3acedd3d381ed6005b2fc2bd6e))
* COV-02 | Incorrect Emit Event ([d1bf4dc](https://github.com/VenusProtocol/oracle/commit/d1bf4dc199ae87d6b5e4e1567ff41bdd11d0d6bb))
* COV-04 | Use Temporary Variable To Store `previousPriceMantissa` ([58b3b2f](https://github.com/VenusProtocol/oracle/commit/58b3b2ff26fdcdbdaf6522fb4ffe6ebe71331af0))
* deploy contracts using hh runtime ([0ab3294](https://github.com/VenusProtocol/oracle/commit/0ab32943749f666fb160ace5795242ff8f14afbb))
* deploy missing token ([b2ffe01](https://github.com/VenusProtocol/oracle/commit/b2ffe0168098a857e3c453aba72dc4e32a878807))
* deployment scripts pass check ([ed2f403](https://github.com/VenusProtocol/oracle/commit/ed2f403b8098cba427cf6199413a1ec477faf9d7))
* fix lint errors ([bafe8aa](https://github.com/VenusProtocol/oracle/commit/bafe8aa4b50f74d4213403c1692318eb3a4df889))
* fixed deployment in fork tests ([672a0ed](https://github.com/VenusProtocol/oracle/commit/672a0ed58c81ad1d76678f260cc3923ee609ab67))
* fixed flaky tests ([991517d](https://github.com/VenusProtocol/oracle/commit/991517da607019f43db71c9aac7695a474f01da1))
* fixed lint ([849ffd5](https://github.com/VenusProtocol/oracle/commit/849ffd563e60a45780eae4d1126983e7b32d9ed6))
* ignore changelog ([5b9029c](https://github.com/VenusProtocol/oracle/commit/5b9029ca62e3af960f2acc37edf6d4efd2a622a5))
* install failure ([c1ef20e](https://github.com/VenusProtocol/oracle/commit/c1ef20e184635d1562d38083703edb7e6c77a5ed))
* L-01 ([ddd4b02](https://github.com/VenusProtocol/oracle/commit/ddd4b0222e40f1b6accf4f003face5206e947489))
* L-02 ([f4352f1](https://github.com/VenusProtocol/oracle/commit/f4352f1403bf7adb5d4a10533b1806bc73b797e4))
* lint issues ([ebaff0b](https://github.com/VenusProtocol/oracle/commit/ebaff0b976651d210ab89485556c05610cbaf75a))
* linting issues ([ffc5b8f](https://github.com/VenusProtocol/oracle/commit/ffc5b8ffa56e0fc3d933b478dc3bf5dd1f91f321))
* N-01 ([70a2211](https://github.com/VenusProtocol/oracle/commit/70a22115b2f0d55c0ab431ce2380a54208460954))
* N-03 ([66707bd](https://github.com/VenusProtocol/oracle/commit/66707bd77d7fd6011d1ea86f423212d17febd802))
* N-04 ([28f4924](https://github.com/VenusProtocol/oracle/commit/28f49241f8d88fed6b523c6fe2059c9bbfc25c12))
* N-07 ([e11f135](https://github.com/VenusProtocol/oracle/commit/e11f135c5876cf86f236b810b0ff4930ef140160))
* N-10 ([5d811fd](https://github.com/VenusProtocol/oracle/commit/5d811fdcf703d2d2c3fddbe0a41e978ed5bb1b6e))
* N-11 ([cf6a66c](https://github.com/VenusProtocol/oracle/commit/cf6a66cca1b58e6593c175bfe403d1c6207356f0))
* N-13 ([c420a18](https://github.com/VenusProtocol/oracle/commit/c420a18cac4ac7b65e65b6eb73d1753b11aaa9e6))
* N-15 ([4f56661](https://github.com/VenusProtocol/oracle/commit/4f56661234ce02e44063464c8f7a87b97cfb5acd))
* Note(1)-1,2 ([4a3de01](https://github.com/VenusProtocol/oracle/commit/4a3de01a0055c47ebe6776d4d2e6f6101eb3db01))
* Note(2) - 1,2 ([24a400c](https://github.com/VenusProtocol/oracle/commit/24a400c9e30776cbd6ff8cb5d3b9866daaab74d8))
* Note(3)-1 ([edda4ef](https://github.com/VenusProtocol/oracle/commit/edda4effb85144a4f4034fe6e00f60a3ffb7d931))
* Note(4) ([75cdadc](https://github.com/VenusProtocol/oracle/commit/75cdadcf32c7b3dac7df8784391dab6918c20bbc))
* POV-01 | Can Use Modifier To Zero Check Address ([8439068](https://github.com/VenusProtocol/oracle/commit/8439068499515f40cabc8ed5f1d6632dd621826f))
* POV-02 | Unnecessary Casting ([0cc250e](https://github.com/VenusProtocol/oracle/commit/0cc250e327adcfd0aa982d03c840266f0238f6e6))
* PVE001 lint/prettier issues ([04ac592](https://github.com/VenusProtocol/oracle/commit/04ac59263ad50d6ad96199488a30d22114d67d6b))
* PVE001 vBnb not having underlying() function critical bug ([e4527db](https://github.com/VenusProtocol/oracle/commit/e4527dbb3e39e283c9296e8932030db2b4d52f82))
* PVE002 Fixed documentation ([3f5737b](https://github.com/VenusProtocol/oracle/commit/3f5737b2d6c5dd375607338d4b822983e270a834))
* rafctored resilient oracle ([869a24c](https://github.com/VenusProtocol/oracle/commit/869a24cf637f2a6f65055a744e67caf3b4cb09ea))
* remove exports add dist ([23c768b](https://github.com/VenusProtocol/oracle/commit/23c768b95b2ce9449d0009f8a14248fa55453ea7))
* remove extra docgen key ([974abd8](https://github.com/VenusProtocol/oracle/commit/974abd8614ca75db6b2c8c95d3109aa0b932dfb9))
* remove generated types from deploy scripts ([490bed2](https://github.com/VenusProtocol/oracle/commit/490bed261c1bec9f5ad0d1cc259ec8a2fe07c200))
* remove postinstall script ([17792bc](https://github.com/VenusProtocol/oracle/commit/17792bcbfab955e62a5988992e7d1ef65157e6fe))
* require using node 14 ([c560aac](https://github.com/VenusProtocol/oracle/commit/c560aac13d0220b722261ef2e3d4ed76e4428c4b))
* review comments ([c71fbd7](https://github.com/VenusProtocol/oracle/commit/c71fbd778eeacb77401581eee14cf4f1373debce))
* ROV-01 | `fallbackPrice` Is Tested Against `mainPrice` ([47ea827](https://github.com/VenusProtocol/oracle/commit/47ea8274691ca8f9a8fcd691dfe48e5269b4cfbc))
* ROV-02 | Missing Zero Address Validation ([8a1fe02](https://github.com/VenusProtocol/oracle/commit/8a1fe027d65bd298fdabfb139a253dc9b86d14fc))
* set one second tolerance to timestamp check ([05ba00e](https://github.com/VenusProtocol/oracle/commit/05ba00eff4391cebef001240839b9c3407545a6b))
* support higher solidity versions ([463c090](https://github.com/VenusProtocol/oracle/commit/463c0900440d9897a5b1294f21546098b2090aa2))
* ts lint errors ([b140a95](https://github.com/VenusProtocol/oracle/commit/b140a956c6818149f7729fb54adec928fe2060c2))
* typos ([144cc8b](https://github.com/VenusProtocol/oracle/commit/144cc8b80332623dfd36ad269454f392d2d622c8))
* update comment for poke window values ([7f99bec](https://github.com/VenusProtocol/oracle/commit/7f99bec4ceb3c524d40e3cd78519adb81493cdd5))
* update exports so default is deploy function and others are named ([71abe3c](https://github.com/VenusProtocol/oracle/commit/71abe3c6db3dd8e8341966ebab3fec5dd9599d7f))
* update oracle deployments ([20de323](https://github.com/VenusProtocol/oracle/commit/20de323b085255e50bd0ff17eb75ea5931a93265))
* update type imports ([fdc57e5](https://github.com/VenusProtocol/oracle/commit/fdc57e5ab2d897cf579dc7499e17b5ac7958e753))
* update version to trigger semantic-release ([b42b39a](https://github.com/VenusProtocol/oracle/commit/b42b39a2b1ba125c47cc03bf2c8505de18870469))
* VPB-01 | Typos and Inconsistencies ([9162a49](https://github.com/VenusProtocol/oracle/commit/9162a4900c21f83a743ae3ed2a2d4174e7e76ef0))
* VPB-01 | Typos and Inconsistencies ([d6747cc](https://github.com/VenusProtocol/oracle/commit/d6747cca2e552afad4e8a7977beb7e516f71c93f))
* VPB-02 | Unnecessary Checks ([81dc384](https://github.com/VenusProtocol/oracle/commit/81dc384e076b3f42b70912d144b2b9d7d36d0d5b))
* VPB-05 | Discussion On Access Control Convention ([cf682c7](https://github.com/VenusProtocol/oracle/commit/cf682c76f381d9dbc07cb5f478e02c8602343875))
* VPU-01 | Unchecked Blocks Can Optimize Contract ([e3dd0e4](https://github.com/VenusProtocol/oracle/commit/e3dd0e4a78390cc718abcaf977b8281cb2ba7a71))

## [1.6.11-dev.9](https://github.com/VenusProtocol/oracle/compare/v1.6.11-dev.8...v1.6.11-dev.9) (2023-05-26)


### Bug Fixes

* fixed deployment in fork tests ([672a0ed](https://github.com/VenusProtocol/oracle/commit/672a0ed58c81ad1d76678f260cc3923ee609ab67))
* L-01 ([ddd4b02](https://github.com/VenusProtocol/oracle/commit/ddd4b0222e40f1b6accf4f003face5206e947489))
* L-02 ([f4352f1](https://github.com/VenusProtocol/oracle/commit/f4352f1403bf7adb5d4a10533b1806bc73b797e4))
* N-01 ([70a2211](https://github.com/VenusProtocol/oracle/commit/70a22115b2f0d55c0ab431ce2380a54208460954))
* N-03 ([66707bd](https://github.com/VenusProtocol/oracle/commit/66707bd77d7fd6011d1ea86f423212d17febd802))
* N-04 ([28f4924](https://github.com/VenusProtocol/oracle/commit/28f49241f8d88fed6b523c6fe2059c9bbfc25c12))
* N-07 ([e11f135](https://github.com/VenusProtocol/oracle/commit/e11f135c5876cf86f236b810b0ff4930ef140160))
* N-10 ([5d811fd](https://github.com/VenusProtocol/oracle/commit/5d811fdcf703d2d2c3fddbe0a41e978ed5bb1b6e))
* N-11 ([cf6a66c](https://github.com/VenusProtocol/oracle/commit/cf6a66cca1b58e6593c175bfe403d1c6207356f0))
* N-13 ([c420a18](https://github.com/VenusProtocol/oracle/commit/c420a18cac4ac7b65e65b6eb73d1753b11aaa9e6))
* N-15 ([4f56661](https://github.com/VenusProtocol/oracle/commit/4f56661234ce02e44063464c8f7a87b97cfb5acd))

## [1.6.11-dev.8](https://github.com/VenusProtocol/oracle/compare/v1.6.11-dev.7...v1.6.11-dev.8) (2023-05-26)

## [1.6.11-dev.7](https://github.com/VenusProtocol/oracle/compare/v1.6.11-dev.6...v1.6.11-dev.7) (2023-05-11)


### Bug Fixes

* add faucet ([0f7b8f1](https://github.com/VenusProtocol/oracle/commit/0f7b8f18fb982bf09d27372d907461f788570ece))
* deploy contracts using hh runtime ([0ab3294](https://github.com/VenusProtocol/oracle/commit/0ab32943749f666fb160ace5795242ff8f14afbb))

## [1.6.11-dev.6](https://github.com/VenusProtocol/oracle/compare/v1.6.11-dev.5...v1.6.11-dev.6) (2023-05-09)


### Bug Fixes

* remove exports add dist ([23c768b](https://github.com/VenusProtocol/oracle/commit/23c768b95b2ce9449d0009f8a14248fa55453ea7))

## [1.6.11-dev.5](https://github.com/VenusProtocol/oracle/compare/v1.6.11-dev.4...v1.6.11-dev.5) (2023-05-08)


### Bug Fixes

* ignore changelog ([5b9029c](https://github.com/VenusProtocol/oracle/commit/5b9029ca62e3af960f2acc37edf6d4efd2a622a5))

## [1.6.11-dev.4](https://github.com/VenusProtocol/oracle/compare/v1.6.11-dev.3...v1.6.11-dev.4) (2023-05-05)


### Bug Fixes

* BOV-01 | `BinanceOracle` Does Not Properly Implement `OracleInterface` ([c4799d0](https://github.com/VenusProtocol/oracle/commit/c4799d087ca2d1940854b7bee1c834fc2e59c2f9))
* BOV-02 | Gas Optimizations When Comparing Strings ([d7e1588](https://github.com/VenusProtocol/oracle/commit/d7e15884f5f6a2def4875b775d203e0b90bbac05))
* COV-01 | Chainlink Can Return Negative Price That Will Not Be Reverted ([78921ef](https://github.com/VenusProtocol/oracle/commit/78921ef20f98cc3acedd3d381ed6005b2fc2bd6e))
* COV-02 | Incorrect Emit Event ([d1bf4dc](https://github.com/VenusProtocol/oracle/commit/d1bf4dc199ae87d6b5e4e1567ff41bdd11d0d6bb))
* COV-04 | Use Temporary Variable To Store `previousPriceMantissa` ([58b3b2f](https://github.com/VenusProtocol/oracle/commit/58b3b2ff26fdcdbdaf6522fb4ffe6ebe71331af0))
* fixed flaky tests ([991517d](https://github.com/VenusProtocol/oracle/commit/991517da607019f43db71c9aac7695a474f01da1))
* fixed lint ([849ffd5](https://github.com/VenusProtocol/oracle/commit/849ffd563e60a45780eae4d1126983e7b32d9ed6))
* POV-01 | Can Use Modifier To Zero Check Address ([8439068](https://github.com/VenusProtocol/oracle/commit/8439068499515f40cabc8ed5f1d6632dd621826f))
* POV-02 | Unnecessary Casting ([0cc250e](https://github.com/VenusProtocol/oracle/commit/0cc250e327adcfd0aa982d03c840266f0238f6e6))
* ROV-01 | `fallbackPrice` Is Tested Against `mainPrice` ([47ea827](https://github.com/VenusProtocol/oracle/commit/47ea8274691ca8f9a8fcd691dfe48e5269b4cfbc))
* ROV-02 | Missing Zero Address Validation ([8a1fe02](https://github.com/VenusProtocol/oracle/commit/8a1fe027d65bd298fdabfb139a253dc9b86d14fc))
* VPB-01 | Typos and Inconsistencies ([9162a49](https://github.com/VenusProtocol/oracle/commit/9162a4900c21f83a743ae3ed2a2d4174e7e76ef0))
* VPB-01 | Typos and Inconsistencies ([d6747cc](https://github.com/VenusProtocol/oracle/commit/d6747cca2e552afad4e8a7977beb7e516f71c93f))
* VPB-02 | Unnecessary Checks ([81dc384](https://github.com/VenusProtocol/oracle/commit/81dc384e076b3f42b70912d144b2b9d7d36d0d5b))
* VPB-05 | Discussion On Access Control Convention ([cf682c7](https://github.com/VenusProtocol/oracle/commit/cf682c76f381d9dbc07cb5f478e02c8602343875))
* VPU-01 | Unchecked Blocks Can Optimize Contract ([e3dd0e4](https://github.com/VenusProtocol/oracle/commit/e3dd0e4a78390cc718abcaf977b8281cb2ba7a71))

## [1.6.11-dev.3](https://github.com/VenusProtocol/oracle/compare/v1.6.11-dev.2...v1.6.11-dev.3) (2023-05-04)


### Bug Fixes

* remove postinstall script ([17792bc](https://github.com/VenusProtocol/oracle/commit/17792bcbfab955e62a5988992e7d1ef65157e6fe))

## [1.6.11-dev.2](https://github.com/VenusProtocol/oracle/compare/v1.6.11-dev.1...v1.6.11-dev.2) (2023-05-04)


### Bug Fixes

* update version to trigger semantic-release ([b42b39a](https://github.com/VenusProtocol/oracle/commit/b42b39a2b1ba125c47cc03bf2c8505de18870469))

## 1.0.0-dev.1 (2023-05-03)


### Features

* add PriceOracle interface ([2ef3b18](https://github.com/VenusProtocol/oracle/commit/2ef3b18456e1ffc078ab2b600b8bcc2a96b4d669))
* conditionally deploy mock oracles in non live environments ([a29175e](https://github.com/VenusProtocol/oracle/commit/a29175ed90334ec8168fd1739f97f5d8f610e5d2))
* include contracts in package ([1a09129](https://github.com/VenusProtocol/oracle/commit/1a09129b21606abcac5b13cc4e38f4168ace3481))
* publish from ci ([53a7171](https://github.com/VenusProtocol/oracle/commit/53a7171fc6b1b67c9f56975209484d6415efc62a))


### Bug Fixes

* add missing types for sinon-chai ([2a45a57](https://github.com/VenusProtocol/oracle/commit/2a45a57f2e7198d35de8e927a1ab4c624c7de88a))
* configure resilient oracle for local deployment ([bdec0e5](https://github.com/VenusProtocol/oracle/commit/bdec0e5798f262e44e1ceeaf7d31ccf5cd9d402c))
* configure resilient oracle for local deployment ([140d186](https://github.com/VenusProtocol/oracle/commit/140d1860ae0f8f94438ecc0cd7dac8a2c04699a7))
* deploy missing token ([b2ffe01](https://github.com/VenusProtocol/oracle/commit/b2ffe0168098a857e3c453aba72dc4e32a878807))
* deployment scripts pass check ([ed2f403](https://github.com/VenusProtocol/oracle/commit/ed2f403b8098cba427cf6199413a1ec477faf9d7))
* fix lint errors ([bafe8aa](https://github.com/VenusProtocol/oracle/commit/bafe8aa4b50f74d4213403c1692318eb3a4df889))
* install failure ([c1ef20e](https://github.com/VenusProtocol/oracle/commit/c1ef20e184635d1562d38083703edb7e6c77a5ed))
* lint issues ([ebaff0b](https://github.com/VenusProtocol/oracle/commit/ebaff0b976651d210ab89485556c05610cbaf75a))
* linting issues ([ffc5b8f](https://github.com/VenusProtocol/oracle/commit/ffc5b8ffa56e0fc3d933b478dc3bf5dd1f91f321))
* Note(1)-1,2 ([4a3de01](https://github.com/VenusProtocol/oracle/commit/4a3de01a0055c47ebe6776d4d2e6f6101eb3db01))
* Note(2) - 1,2 ([24a400c](https://github.com/VenusProtocol/oracle/commit/24a400c9e30776cbd6ff8cb5d3b9866daaab74d8))
* Note(3)-1 ([edda4ef](https://github.com/VenusProtocol/oracle/commit/edda4effb85144a4f4034fe6e00f60a3ffb7d931))
* Note(4) ([75cdadc](https://github.com/VenusProtocol/oracle/commit/75cdadcf32c7b3dac7df8784391dab6918c20bbc))
* PVE001 lint/prettier issues ([04ac592](https://github.com/VenusProtocol/oracle/commit/04ac59263ad50d6ad96199488a30d22114d67d6b))
* PVE001 vBnb not having underlying() function critical bug ([e4527db](https://github.com/VenusProtocol/oracle/commit/e4527dbb3e39e283c9296e8932030db2b4d52f82))
* PVE002 Fixed documentation ([3f5737b](https://github.com/VenusProtocol/oracle/commit/3f5737b2d6c5dd375607338d4b822983e270a834))
* rafctored resilient oracle ([869a24c](https://github.com/VenusProtocol/oracle/commit/869a24cf637f2a6f65055a744e67caf3b4cb09ea))
* remove extra docgen key ([974abd8](https://github.com/VenusProtocol/oracle/commit/974abd8614ca75db6b2c8c95d3109aa0b932dfb9))
* remove generated types from deploy scripts ([490bed2](https://github.com/VenusProtocol/oracle/commit/490bed261c1bec9f5ad0d1cc259ec8a2fe07c200))
* require using node 14 ([c560aac](https://github.com/VenusProtocol/oracle/commit/c560aac13d0220b722261ef2e3d4ed76e4428c4b))
* review comments ([c71fbd7](https://github.com/VenusProtocol/oracle/commit/c71fbd778eeacb77401581eee14cf4f1373debce))
* set one second tolerance to timestamp check ([05ba00e](https://github.com/VenusProtocol/oracle/commit/05ba00eff4391cebef001240839b9c3407545a6b))
* support higher solidity versions ([463c090](https://github.com/VenusProtocol/oracle/commit/463c0900440d9897a5b1294f21546098b2090aa2))
* ts lint errors ([b140a95](https://github.com/VenusProtocol/oracle/commit/b140a956c6818149f7729fb54adec928fe2060c2))
* typos ([144cc8b](https://github.com/VenusProtocol/oracle/commit/144cc8b80332623dfd36ad269454f392d2d622c8))
* update comment for poke window values ([7f99bec](https://github.com/VenusProtocol/oracle/commit/7f99bec4ceb3c524d40e3cd78519adb81493cdd5))
* update exports so default is deploy function and others are named ([71abe3c](https://github.com/VenusProtocol/oracle/commit/71abe3c6db3dd8e8341966ebab3fec5dd9599d7f))
* update oracle deployments ([20de323](https://github.com/VenusProtocol/oracle/commit/20de323b085255e50bd0ff17eb75ea5931a93265))
* update type imports ([fdc57e5](https://github.com/VenusProtocol/oracle/commit/fdc57e5ab2d897cf579dc7499e17b5ac7958e753))
