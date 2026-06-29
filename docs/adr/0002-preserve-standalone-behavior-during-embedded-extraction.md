# Preserve standalone behavior during embedded extraction

The first embedded-mode implementation will extract shared dashboard behavior into an embedded core without changing existing standalone CLI behavior. Existing CLI flags, environment variables, Redis discovery, Basic Auth behavior, root-mounted dashboard routes, and private tRPC routes remain compatibility-sensitive while embedded packages are added as an additive capability.
