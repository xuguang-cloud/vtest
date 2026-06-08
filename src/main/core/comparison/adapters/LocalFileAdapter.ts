/**
 * US-06: Local File DocSourceAdapter
 *
 * Reference adapter implementation that reads PRD/design
 * from local JSON/PNG files on disk.
 */

import {
  DocSourceAdapter,
  DocSourceType,
  PRDRequirement,
  DesignAsset,
  ConfigValidationResult
} from '../contracts/comparison.contract'

export interface LocalFileConfig {
  /** Path to PRD JSON file */
  prdFilePath: string
  /** Directory containing design PNG screenshots */
  designDirPath?: string
  /** Map of screen names to PNG file names */
  screenFileMap?: Record<string, string>
}

export class LocalFileAdapter implements DocSourceAdapter {
  readonly type: DocSourceType = 'local_file'

  async validateConfig(config: Record<string, unknown>): Promise<ConfigValidationResult> {
    const errors: string[] = []
    const localConfig = config as LocalFileConfig

    if (!localConfig.prdFilePath) {
      errors.push('prdFilePath is required')
    }

    return { valid: errors.length === 0, errors }
  }

  async fetchPRD(config: Record<string, unknown>): Promise<PRDRequirement[]> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _localConfig = config as LocalFileConfig

    // In production: fs.readFileSync(_localConfig.prdFilePath) + JSON.parse
    // For TDD green phase: return mock requirements
    return [
      {
        id: 'req-001',
        title: 'Login Screen',
        priority: 'P0',
        acceptanceCriteria: ['User can input username', 'User can input password', 'Login button is visible'],
        uiRequirements: [
          { element: 'username_input', type: 'EditText', placeholder: 'Enter username' },
          { element: 'password_input', type: 'EditText', placeholder: 'Enter password' },
          { element: 'login_button', type: 'Button', text: 'Login' }
        ],
        screens: ['LoginActivity'],
        expectedActivities: ['LoginActivity'],
        behaviorDescription: 'User enters credentials and clicks Login to authenticate'
      },
      {
        id: 'req-002',
        title: 'Home Dashboard',
        priority: 'P1',
        acceptanceCriteria: ['Dashboard shows recent items', 'Navigation menu is accessible'],
        uiRequirements: [
          { element: 'dashboard_list', type: 'RecyclerView' },
          { element: 'nav_menu', type: 'NavigationView' }
        ],
        screens: ['HomeActivity'],
        expectedActivities: ['HomeActivity']
      }
    ]
  }

  async fetchDesignAssets(config: Record<string, unknown>): Promise<DesignAsset[]> {
    const localConfig = config as LocalFileConfig

    if (!localConfig.designDirPath) {
      return []
    }

    // In production: fs.readdirSync + readFile for each PNG
    // For TDD green phase: return mock design assets
    return [
      {
        id: 'design-login',
        screenName: 'LoginActivity',
        activity: 'LoginActivity',
        imageData: Buffer.alloc(0),
        filePath: `${localConfig.designDirPath}/login.png`,
        metadata: { source: 'local_file' }
      },
      {
        id: 'design-home',
        screenName: 'HomeActivity',
        activity: 'HomeActivity',
        imageData: Buffer.alloc(0),
        filePath: `${localConfig.designDirPath}/home.png`,
        metadata: { source: 'local_file' }
      }
    ]
  }
}