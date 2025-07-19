# Release Process for SZIP

## Quick Release
```bash
npm run release:patch    # Bug fixes
npm run release:minor    # New features  
npm run release:major    # Breaking changes
```

## Manual Release Steps

### 1. Pre-Release
- [ ] Update CHANGELOG.md
- [ ] Run all tests: `npm test`
- [ ] Security audit: `npm audit`
- [ ] Build project: `npm run build`

### 2. Version Bump
- [ ] Choose version type: `npm version [patch|minor|major]`
- [ ] Update package.json version
- [ ] Git tag created automatically

### 3. Publication  
- [ ] Login to NPM: `npm login`
- [ ] Publish: `npm publish`
- [ ] Verify: https://npmjs.com/package/simpl-zip

### 4. Post-Release
- [ ] Push to GitHub: `git push --tags`
- [ ] Create GitHub release
- [ ] Update documentation
- [ ] Announce release

## Rollback Process
```bash
# Unpublish within 24 hours (if needed)
npm unpublish simpl-zip@1.0.0

# Deprecate version (preferred)
npm deprecate simpl-zip@1.0.0 "Deprecated due to critical bug"
```

## Release Checklist Template

- [ ] Code complete and reviewed
- [ ] All tests passing
- [ ] Documentation updated  
- [ ] Version bumped
- [ ] CHANGELOG.md updated
- [ ] Security audit passed
- [ ] Package validated
- [ ] NPM publish successful
- [ ] Installation verified
- [ ] GitHub release created
