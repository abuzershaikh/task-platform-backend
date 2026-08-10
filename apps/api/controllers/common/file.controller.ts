import {
    Controller,
    Post,
    Get,
    Param,
    Res,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { FileStorageService } from '../../../../shared/services/file-storage.service';
import { CurrentUser } from '../../../../shared/auth/decorators/current-user.decorator';
import { User, UserRole } from '../../../../shared/database/entities/user.entity';
import { FileType } from '../../../../shared/database/entities/file.entity';

@ApiTags('Files')
@Controller('files')
export class FileController {
    constructor(private readonly fileStorage: FileStorageService) { }

    @Post('upload')
    @ApiBearerAuth('bearer')
    @ApiOperation({ summary: 'Upload a file (proof, image, doc)' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(
        @UploadedFile() file: any,
        @CurrentUser() user: User,
    ) {
        if (!file) {
            throw new BadRequestException('No file provided');
        }

        let type = FileType.DOCUMENT;
        if (file.mimetype.startsWith('image/')) type = FileType.IMAGE;
        else if (file.mimetype.startsWith('video/')) type = FileType.VIDEO;

        const savedFile = await this.fileStorage.saveFile({
            uploadedBy: user.id,
            type,
            originalName: file.originalname,
            mimeType: file.mimetype,
            buffer: file.buffer,
        });

        return {
            success: true,
            file: {
                id: savedFile.id,
                originalName: savedFile.originalName,
                mimeType: savedFile.mimeType,
                fileSize: savedFile.fileSize,
                filePath: savedFile.filePath,
                createdAt: savedFile.createdAt,
            },
        };
    }

    @Get(':id/download')
    @ApiBearerAuth('bearer')
    @ApiOperation({ summary: 'Download or view file content' })
    async getFile(
        @Param('id') fileId: string,
        @CurrentUser() user: User,
        @Res() res: Response,
    ) {
        const { stream, file } = await this.fileStorage.getFileStream(fileId);

        // Security ownership check: Admin can view all, worker can view own files, buyer can view files if permitted
        if (
            user.role !== UserRole.ADMIN &&
            user.role !== UserRole.SUPER_ADMIN &&
            file.uploadedBy !== user.id &&
            user.role !== UserRole.BUYER
        ) {
            throw new ForbiddenException('Access denied to file');
        }

        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
        stream.pipe(res);
    }
}
